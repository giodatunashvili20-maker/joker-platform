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

    // Lock earliest 4 compatible queue rows (to avoid double-matching)
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
      `INSERT INTO matches (id, game_type, mode, xishte, delete_scope, tier, player1_id, player2_id, player3_id, player4_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active')`,
      [matchId, a.game_type, a.mode, a.xishte, a.delete_scope, a.tier, a.user_id, b.user_id, c.user_id, d.user_id]
    );

    await client.query(`DELETE FROM matchmaking_queue WHERE id IN ($1,$2,$3,$4)`, [a.id, b.id, c.id, d.id]);

    await client.query("COMMIT");
    return { matched: true, matchId, players: [a.user_id, b.user_id, c.user_id, d.user_id] };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/* ============================= */

/* ============================= */

router.post("/matchmaking/join", requireAuth, requireNotBanned, async (req, res) => {
  const { gameType, mode, xishte = 1, deleteScope = "last" } = req.body || {};
  const gt = String(gameType || "").toLowerCase();
  const md = String(mode || "").toLowerCase();
  const xs = Number(xishte);

  if (!["joker", "bura", "nardi", "domino"].includes(gt)) return res.status(400).json({ error: "BAD_GAME_TYPE" });
  if (gt === "joker" && !["ones", "nines"].includes(md)) return res.status(400).json({ error: "BAD_MODE" });
  if (![1, 2, 3].includes(xs)) return res.status(400).json({ error: "BAD_XISHTE" });
  if (!["last", "all"].includes(deleteScope)) return res.status(400).json({ error: "BAD_DELETE_SCOPE" });

  const ur = await pool.query("SELECT level FROM users WHERE id=$1", [req.user.id]);
  const level = Number(ur.rows[0]?.level || 1);
  const tier = tierForLevel(level);

  const id = uuidv4();
  await pool.query(
    `
    INSERT INTO matchmaking_queue (id,user_id,game_type,mode,xishte,delete_scope,tier)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (user_id, game_type)
    DO UPDATE SET mode=EXCLUDED.mode, xishte=EXCLUDED.xishte, delete_scope=EXCLUDED.delete_scope, tier=EXCLUDED.tier, created_at=NOW()
    `,
    [id, req.user.id, gt, gt === "joker" ? md : "default", xs, deleteScope, tier]
  );

  // Try to create a 4-player match if enough players are waiting
  let attempt = { matched: false };
  try {
    attempt = await tryCreateMatch4({ gameType: gt, mode: gt === "joker" ? md : "default", xishte: xs, deleteScope, tier });
  } catch (e) {
    // If matching fails for any reason, user stays in queue; client can keep polling.
    attempt = { matched: false, error: "MATCHER_ERROR" };
  }

  const cnt = await pool.query(
    `SELECT COUNT(*)::int AS c FROM matchmaking_queue WHERE game_type=$1 AND mode=$2 AND tier=$3`,
    [gt, gt === "joker" ? md : "default", tier]
  );

  return res.json({ ok: true, gameType: gt, mode: gt === "joker" ? md : "default", xishte: xs, deleteScope, tier, waiting: cnt.rows[0].c, attempt });
});


router.get("/matchmaking/status", requireAuth, async (req, res) => {
  const userId = req.user.id;

  // 1) Active match?
  const m = await pool.query(
    `SELECT id, game_type, mode, xishte, delete_scope, tier, status, created_at
     FROM matches
     WHERE status='active' AND ($1 IN (player1_id, player2_id, player3_id, player4_id))
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  if (m.rows[0]) return res.json({ state: "matched", match: m.rows[0] });

  // 2) In queue?
  const q = await pool.query(
    `SELECT id, game_type, mode, xishte, delete_scope, tier, created_at
     FROM matchmaking_queue
     WHERE user_id=$1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  if (q.rows[0]) return res.json({ state: "waiting", queue: q.rows[0] });

  return res.json({ state: "idle" });
});


router.post("/matchmaking/leave", requireAuth, async (req, res) => {
  const { gameType } = req.body || {};
  const gt = String(gameType || "").toLowerCase();
  if (!["joker", "bura", "nardi", "domino"].includes(gt)) return res.status(400).json({ error: "BAD_GAME_TYPE" });

  await pool.query("DELETE FROM matchmaking_queue WHERE user_id=$1 AND game_type=$2", [req.user.id, gt]);
  return res.json({ ok: true });
});

/* ============================= */

export default router;
