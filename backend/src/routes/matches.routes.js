import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireNotBanned } from "../middleware/auth.js";

const router = Router();

/**
 * GET /matches/:id
 * Returns basic match info + player usernames.
 * Used by frontend table mock to show opponent names.
 */
router.get("/matches/:id", requireAuth, requireNotBanned, async (req, res) => {
  const { id } = req.params;

  const m = await pool.query(
    `SELECT id, game_type, mode, xishte, delete_scope, tier, status,
            player1_id, player2_id, player3_id, player4_id, created_at
     FROM matches
     WHERE id=$1`,
    [id]
  );

  if (!m.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });

  const row = m.rows[0];
  const ids = [row.player1_id, row.player2_id, row.player3_id, row.player4_id].filter(Boolean);

  const u = await pool.query(
    `SELECT id, username, level
     FROM users
     WHERE id = ANY($1::int[])`,
    [ids]
  );

  const byId = new Map(u.rows.map(r => [r.id, r]));

  const players = ids.map(uid => {
    const r = byId.get(uid);
    return {
      id: uid,
      username: r?.username ?? `User${uid}`,
      level: r?.level ?? 1,
    };
  });

  return res.json({
    id: row.id,
    gameType: row.game_type,
    mode: row.mode,
    xishte: row.xishte,
    deleteScope: row.delete_scope,
    tier: row.tier,
    status: row.status,
    createdAt: row.created_at,
    players,
  });
});

export default router;
