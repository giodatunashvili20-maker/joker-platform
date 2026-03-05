import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { getRankName, xpProgress } from "../config/economy.js";

const router = Router();

/* ============================= */

router.get("/me", requireAuth, async (req, res) => {
  const r = await pool.query(
    "SELECT id,email,username,points,crystals,xp_total,level,email_verified,phone,phone_verified,leave_strikes,ban_until FROM users WHERE id=$1",
    [req.user.id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: "NOT_FOUND" });

  const me = r.rows[0];
  const progress = xpProgress(Number(me.xp_total));
  const level = Number(me.level);

  return res.json({
    ...me,
    tier: tierForLevel(level),
    rankName: getRankName(level),
    xpCurrent: progress.currentLevelXp,
    xpNeeded: progress.neededForNext,
    xpPercent: progress.percent,
  });
});

/* ============================= */

export default router;
