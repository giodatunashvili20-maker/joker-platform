import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/* ============================= */

function makeJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

router.post("/rooms/create", requireAuth, requireNotBanned, async (req, res) => {
  const { name, gameType, isPrivate = true } = req.body || {};
  const gt = String(gameType || "").toLowerCase();
  if (!name || !gt) return res.status(400).json({ error: "MISSING_FIELDS" });
  if (!["joker", "bura", "nardi", "domino"].includes(gt)) return res.status(400).json({ error: "BAD_GAME_TYPE" });

  const id = uuidv4();
  const joinCode = isPrivate ? makeJoinCode() : null;

  await pool.query(
    "INSERT INTO rooms (id,host_user_id,name,game_type,is_private,join_code) VALUES ($1,$2,$3,$4,$5,$6)",
    [id, req.user.id, name, gt, Boolean(isPrivate), joinCode]
  );

  await pool.query(
  "INSERT INTO room_members (id, room_id, user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
  [uuidv4(), id, req.user.id]
);

  return res.json({ ok: true, roomId: id, joinCode });
});

router.post("/rooms/join", requireAuth, requireNotBanned, async (req, res) => {
  const { roomId, joinCode } = req.body || {};
  if (!roomId) return res.status(400).json({ error: "MISSING_ROOM_ID" });

  const r = await pool.query("SELECT * FROM rooms WHERE id=$1", [roomId]);
  if (!r.rowCount) return res.status(404).json({ error: "ROOM_NOT_FOUND" });

  const room = r.rows[0];
  if (room.is_private && String(joinCode || "").toUpperCase() !== String(room.join_code || "").toUpperCase()) {
    return res.status(403).json({ error: "BAD_JOIN_CODE" });
  }

  await pool.query(
  "INSERT INTO room_members (id, room_id, user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
  [uuidv4(), roomId, req.user.id]
);

  return res.json({ ok: true });
});

router.post("/rooms/leave", requireAuth, async (req, res) => {
  const { roomId } = req.body || {};
  if (!roomId) return res.status(400).json({ error: "MISSING_ROOM_ID" });

  await pool.query("DELETE FROM room_members WHERE room_id=$1 AND user_id=$2", [roomId, req.user.id]);
  return res.json({ ok: true });
});

router.get("/rooms/mine", requireAuth, async (req, res) => {
  const r = await pool.query(
    `
    SELECT rm.room_id, r.name, r.game_type, r.is_private, r.join_code, r.host_user_id
    FROM room_members rm
    JOIN rooms r ON r.id = rm.room_id
    WHERE rm.user_id=$1
    ORDER BY r.created_at DESC
    `,
    [req.user.id]
  );
  return res.json({ rooms: r.rows });
});

// Replace current user with AI bot in room (scaffolding + persistence)
router.post("/rooms/replace-me-with-bot", requireAuth, async (req, res) => {
  const { roomId } = req.body || {};
  if (!roomId) return res.status(400).json({ error: "MISSING_ROOM_ID" });

  const m = await pool.query(
    "SELECT 1 FROM room_members WHERE room_id=$1 AND user_id=$2",
    [roomId, req.user.id]
  );
  if (!m.rowCount) return res.status(403).json({ error: "NOT_IN_ROOM" });

  const ur = await pool.query("SELECT level FROM users WHERE id=$1", [req.user.id]);
  const level = Number(ur.rows[0]?.level || 1);
  const difficulty = level >= 19 ? 3 : level >= 9 ? 2 : 1;
  const botName = `BOT • ${getRankName(level)}`;

  // Create bot
  const botId = uuidv4();
  await pool.query(
    "INSERT INTO bots (id,name,difficulty) VALUES ($1,$2,$3)",
    [botId, botName, difficulty]
  );

  // Remove user from room, add bot member
  await pool.query("DELETE FROM room_members WHERE room_id=$1 AND user_id=$2", [
    roomId,
    req.user.id,
  ]);
  await pool.query(
  "INSERT INTO room_members (id, room_id, bot_id) VALUES ($1,$2,$3)",
  [
    uuidv4(),
    roomId,
    botId,
  ]
);

  return res.json({ ok: true, roomId, botId, botName, difficulty });
});

/* ============================= */

export default router;
