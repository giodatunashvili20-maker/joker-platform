import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db.js";
import { requireAuth, requireNotBanned } from "../middleware/auth.js";
import { tierForLevel } from "../config/economy.js";

const router = Router();

/* ================= MATCHMAKING HELPERS ================= */

async function tryCreateMatch4({ gameType, mode, xishte, deleteScope, tier }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const r = await client.query(
      `SELECT *
       FROM matchmaking_queue
       WHERE game_type=$1 AND mode=$2 AND xishte=$3 AND delete_scope=$4 AND tier=$5
       ORDER BY created_at ASC
       LIMIT 4
       FOR UPDATE`,
      [gameType, mode, xishte, deleteScope, tier]
    );

    if (r.rows.length < 4) {
      await client.query("COMMIT");
      return { matched: false };
    }

    const [a, b, c, d] = r.rows;
    const matchId = uuidv4();

    await client.query(
      `INSERT INTO matches (
         id,
         game_type,
         mode,
         xishte,
         delete_scope,
         tier,
         player1_id,
         player2_id,
         player3_id,
         player4_id,
         status
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active')`,
      [
        matchId,
        a.game_type,
        a.mode,
        a.xishte,
        a.delete_scope,
        a.tier,
        a.user_id,
        b.user_id,
        c.user_id,
        d.user_id,
      ]
    );

    await client.query(
      `DELETE FROM matchmaking_queue WHERE id IN ($1,$2,$3,$4)`,
      [a.id, b.id, c.id, d.id]
    );

    await client.query("COMMIT");
    return {
      matched: true,
      matchId,
      players: [a.user_id, b.user_id, c.user_id, d.user_id],
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function getQueueCount({ gameType, mode, xishte, deleteScope, tier }) {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS c
     FROM matchmaking_queue
     WHERE game_type=$1
       AND mode=$2
       AND xishte=$3
       AND delete_scope=$4
       AND tier=$5`,
    [gameType, mode, xishte, deleteScope, tier]
  );

  return Number(r.rows[0]?.c || 0);
}

/* ============================= */

router.post("/matchmaking/join", requireAuth, requireNotBanned, async (req, res) => {
  const { gameType, mode, xishte = 1, deleteScope = "last" } = req.body || {};

  const gt = String(gameType || "").toLowerCase();
  const md = String(mode || "").toLowerCase();
  const xs = Number(xishte);
  const finalMode = gt === "joker" ? md : "default";

  if (!["joker", "bura", "nardi", "domino"].includes(gt)) {
    return res.status(400).json({ error: "BAD_GAME_TYPE" });
  }

  if (gt === "joker" && !["ones", "nines"].includes(md)) {
    return res.status(400).json({ error: "BAD_MODE" });
  }

  if (![1, 2, 3].includes(xs)) {
    return res.status(400).json({ error: "BAD_XISHTE" });
  }

  if (!["last", "all"].includes(deleteScope)) {
    return res.status(400).json({ error: "BAD_DELETE_SCOPE" });
  }

  const ur = await pool.query("SELECT level FROM users WHERE id=$1", [req.user.id]);
  const level = Number(ur.rows[0]?.level || 1);
  const tier = tierForLevel(level);

  const id = uuidv4();

  await pool.query(
    `
    INSERT INTO matchmaking_queue (id,user_id,game_type,mode,xishte,delete_scope,tier)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (user_id, game_type)
    DO UPDATE SET
      mode=EXCLUDED.mode,
      xishte=EXCLUDED.xishte,
      delete_scope=EXCLUDED.delete_scope,
      tier=EXCLUDED.tier,
      created_at=NOW()
    `,
    [id, req.user.id, gt, finalMode, xs, deleteScope, tier]
  );

  let attempt = { matched: false };
  try {
    attempt = await tryCreateMatch4({
      gameType: gt,
      mode: finalMode,
      xishte: xs,
      deleteScope,
      tier,
    });
  } catch (e) {
    console.error("MATCHER_ERROR:", e);
    attempt = { matched: false, error: "MATCHER_ERROR" };
  }

  const waiting = await getQueueCount({
    gameType: gt,
    mode: finalMode,
    xishte: xs,
    deleteScope,
    tier,
  });

  return res.json({
    ok: true,
    gameType: gt,
    mode: finalMode,
    xishte: xs,
    deleteScope,
    tier,
    waiting,
    attempt,
  });
});

/**
 * აბრუნებს კონკრეტული user-ის matchmaking სტატუსს
 * და თუ queue-შია — ასევე აბრუნებს ამავე queue-ში რამდენი ელოდება
 */
router.get("/matchmaking/status", requireAuth, async (req, res) => {
  const userId = req.user.id;

  // 1) Active match?
  const m = await pool.query(
    `SELECT id, game_type, mode, xishte, delete_scope, tier, status, created_at
     FROM matches
     WHERE status='active'
       AND ($1 IN (player1_id, player2_id, player3_id, player4_id))
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (m.rows[0]) {
    return res.json({ state: "matched", match: m.rows[0] });
  }

  // 2) In queue?
  const q = await pool.query(
    `SELECT id, game_type, mode, xishte, delete_scope, tier, created_at
     FROM matchmaking_queue
     WHERE user_id=$1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (q.rows[0]) {
    const row = q.rows[0];

    const waiting = await getQueueCount({
      gameType: row.game_type,
      mode: row.mode,
      xishte: row.xishte,
      deleteScope: row.delete_scope,
      tier: row.tier,
    });

    return res.json({
      state: "waiting",
      queue: row,
      waiting,
    });
  }

  return res.json({ state: "idle" });
});

/**
 * აბრუნებს queue count-ებს frontend polling-ისთვის
 * რომ წერტილები ყოველ წამს განახლდეს
 */
router.get("/matchmaking/counts", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT mode, COUNT(*)::int AS count
       FROM matchmaking_queue
       WHERE game_type='joker'
       GROUP BY mode`
    );

    const counts = {
      ones: 0,
      nines: 0,
    };

    for (const row of r.rows) {
      if (row.mode === "ones") counts.ones = Number(row.count || 0);
      if (row.mode === "nines") counts.nines = Number(row.count || 0);
    }

    return res.json(counts);
  } catch (e) {
    console.error("MATCHMAKING_COUNTS_ERROR:", e);
    return res.status(500).json({ error: "MATCHMAKING_COUNTS_ERROR" });
  }
});

router.post("/matchmaking/leave", requireAuth, async (req, res) => {
  const { gameType } = req.body || {};
  const gt = String(gameType || "").toLowerCase();

  if (!["joker", "bura", "nardi", "domino"].includes(gt)) {
    return res.status(400).json({ error: "BAD_GAME_TYPE" });
  }

  await pool.query(
    "DELETE FROM matchmaking_queue WHERE user_id=$1 AND game_type=$2",
    [req.user.id, gt]
  );

  return res.json({ ok: true });
});

/* ============================= */

export default router;
