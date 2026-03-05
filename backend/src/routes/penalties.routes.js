import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/* ============================= */

// Call this when player quits/leaves a REAL (non-room) public match.
// Escalation: 1h, 2h, 4h, 8h...
router.post("/penalties/left-game", requireAuth, async (req, res) => {
  const u = await pool.query("SELECT leave_strikes FROM users WHERE id=$1", [
    req.user.id,
  ]);
  const strikes = Number(u.rows[0]?.leave_strikes || 0) + 1;
  const banHours = Math.pow(2, strikes - 1);
  const banUntil = new Date(Date.now() + banHours * 60 * 60 * 1000);

  await pool.query(
    "UPDATE users SET leave_strikes=$2, ban_until=$3 WHERE id=$1",
    [req.user.id, strikes, banUntil.toISOString()]
  );

  return res.json({ ok: true, strikes, banHours, banUntil });
});

/* ============================= */

export default router;
