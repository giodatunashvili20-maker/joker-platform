import express from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireNotBanned } from "../middleware/requireNotBanned.js";

const router = express.Router();

/* CREATE ROOM */
router.post(
  "/rooms/create",
  requireAuth,
  requireNotBanned,
  async (req, res) => {
    try {
      const { name, stake } = req.body;

      const r = await pool.query(
        `INSERT INTO rooms (name, stake, owner_id)
         VALUES ($1,$2,$3)
         RETURNING id,name,stake`,
        [name, stake, req.user.id]
      );

      res.json(r.rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "CREATE_ROOM_FAILED" });
    }
  }
);

/* LIST ROOMS */
router.get("/rooms", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id,name,stake,created_at
       FROM rooms
       ORDER BY created_at DESC
       LIMIT 50`
    );

    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "ROOM_LIST_FAILED" });
  }
});

/* JOIN ROOM */
router.post("/rooms/:id/join", requireAuth, async (req, res) => {
  try {
    const roomId = req.params.id;

    await pool.query(
      `INSERT INTO room_players (room_id,user_id)
       VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [roomId, req.user.id]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "JOIN_ROOM_FAILED" });
  }
});

export default router;
