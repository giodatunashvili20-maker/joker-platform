import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/* ============================= */

router.get("/leaderboard", async (req, res) => {
  const { period = "monthly", limit = 20 } = req.query;

  const p = String(period);
  const lim = Math.max(1, Math.min(200, Number(limit) || 20));

  const now = new Date();
  let key;

  if (p === "daily") key = todayISO();
  else if (p === "weekly") key = weekKey(now);
  else if (p === "monthly") key = monthKey(now);
  else if (p === "yearly") key = yearKey(now);
  else return res.status(400).json({ error: "BAD_PERIOD" });

  const r = await pool.query(
    `
    SELECT u.username, l.score, l.wins
    FROM leaderboard_scores l
    JOIN users u ON u.id = l.user_id
    WHERE l.period_type=$1 AND l.period_key=$2
    ORDER BY l.score DESC, l.wins DESC, u.username ASC
    LIMIT $3
    `,
    [p, key, lim]
  );

  return res.json({ period: p, key, rows: r.rows });
});

router.get("/me/leaderboards", requireAuth, async (req, res) => {
  const now = new Date();
  const periods = [
    { period: "daily", key: todayISO() },
    { period: "weekly", key: weekKey(now) },
    { period: "monthly", key: monthKey(now) },
    { period: "yearly", key: yearKey(now) },
  ];

  const out = {};
  for (const p of periods) {
    const r = await pool.query(
      `SELECT score, wins FROM leaderboard_scores WHERE user_id=$1 AND period_type=$2 AND period_key=$3`,
      [req.user.id, p.period, p.key]
    );
    out[p.period] = {
      key: p.key,
      score: r.rowCount ? Number(r.rows[0].score) : 0,
      wins: r.rowCount ? Number(r.rows[0].wins) : 0,
    };
  }
  return res.json(out);
});

/* ============================= */

export default router;
