import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/* ============================= */

router.get("/users/search", requireAuth, async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ users: [] });

  const r = await pool.query(
    `SELECT id, username FROM users WHERE username ILIKE $1 ORDER BY username ASC LIMIT 20`,
    [`%${q}%`]
  );
  return res.json({ users: r.rows });
});

router.post("/friends/request", requireAuth, async (req, res) => {
  const { toUserId } = req.body || {};
  if (!toUserId) return res.status(400).json({ error: "MISSING_TO_USER" });
  if (toUserId === req.user.id) return res.status(400).json({ error: "CANNOT_FRIEND_SELF" });

  const fr = await pool.query(
    "SELECT 1 FROM friendships WHERE user_id=$1 AND friend_id=$2",
    [req.user.id, toUserId]
  );
  if (fr.rowCount) return res.status(409).json({ error: "ALREADY_FRIENDS" });

  const id = uuidv4();
  await pool.query(
    "INSERT INTO friend_requests (id,from_user_id,to_user_id,status) VALUES ($1,$2,$3,'pending')",
    [id, req.user.id, toUserId]
  );

  return res.json({ ok: true, requestId: id });
});

router.get("/friends/requests", requireAuth, async (req, res) => {
  const r = await pool.query(
    `
    SELECT fr.id, fr.status, fr.created_at, u.id AS from_id, u.username AS from_username
    FROM friend_requests fr
    JOIN users u ON u.id = fr.from_user_id
    WHERE fr.to_user_id=$1 AND fr.status='pending'
    ORDER BY fr.created_at DESC
    `,
    [req.user.id]
  );
  return res.json({ requests: r.rows });
});

router.post("/friends/respond", requireAuth, async (req, res) => {
  const { requestId, action } = req.body || {};
  if (!requestId || !["accept", "reject"].includes(String(action)))
    return res.status(400).json({ error: "BAD_REQUEST" });

  const r = await pool.query(
    "SELECT * FROM friend_requests WHERE id=$1 AND to_user_id=$2",
    [requestId, req.user.id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: "REQUEST_NOT_FOUND" });
  if (r.rows[0].status !== "pending") return res.status(400).json({ error: "ALREADY_DECIDED" });

  if (action === "reject") {
    await pool.query("UPDATE friend_requests SET status='rejected' WHERE id=$1", [requestId]);
    return res.json({ ok: true });
  }

  const fromId = r.rows[0].from_user_id;
  await pool.query("UPDATE friend_requests SET status='accepted' WHERE id=$1", [requestId]);

  await pool.query(
    "INSERT INTO friendships (user_id, friend_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
    [req.user.id, fromId]
  );
  await pool.query(
    "INSERT INTO friendships (user_id, friend_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
    [fromId, req.user.id]
  );

  return res.json({ ok: true });
});

router.get("/friends/list", requireAuth, async (req, res) => {
  const r = await pool.query(
    `
    SELECT u.id, u.username
    FROM friendships f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id=$1
    ORDER BY u.username ASC
    `,
    [req.user.id]
  );
  return res.json({ friends: r.rows });
});

router.post("/chat/dm/send", requireAuth, async (req, res) => {
  const { toUserId, kind = "text", content } = req.body || {};
  if (!toUserId || !content) return res.status(400).json({ error: "MISSING_FIELDS" });
  if (!["text", "emoji", "emote", "gif"].includes(kind)) return res.status(400).json({ error: "BAD_KIND" });

  const fr = await pool.query(
    "SELECT 1 FROM friendships WHERE user_id=$1 AND friend_id=$2",
    [req.user.id, toUserId]
  );
  if (!fr.rowCount) return res.status(403).json({ error: "NOT_FRIENDS" });

  const id = uuidv4();
  await pool.query(
    "INSERT INTO dm_messages (id,from_user_id,to_user_id,kind,content) VALUES ($1,$2,$3,$4,$5)",
    [id, req.user.id, toUserId, kind, String(content)]
  );
  return res.json({ ok: true, id });
});

router.get("/chat/dm/history", requireAuth, async (req, res) => {
  const withUserId = String(req.query.withUserId || "");
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
  if (!withUserId) return res.status(400).json({ error: "MISSING_WITH_USER" });

  const fr = await pool.query(
    "SELECT 1 FROM friendships WHERE user_id=$1 AND friend_id=$2",
    [req.user.id, withUserId]
  );
  if (!fr.rowCount) return res.status(403).json({ error: "NOT_FRIENDS" });

  const r = await pool.query(
    `
    SELECT id, from_user_id, to_user_id, kind, content, created_at
    FROM dm_messages
    WHERE (from_user_id=$1 AND to_user_id=$2) OR (from_user_id=$2 AND to_user_id=$1)
    ORDER BY created_at DESC
    LIMIT $3
    `,
    [req.user.id, withUserId, limit]
  );
  return res.json({ messages: r.rows.reverse() });
});

/* ============================= */

export default router;
