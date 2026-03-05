import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireNotBanned } from "../middleware/auth.js";
import { ADS_LIMITS, ensureAdReset } from "../config/ads.js";
import { TIERS, tierForLevel } from "../config/economy.js";

const router = Router();

/**
 * NOTE: These endpoints only grant rewards AFTER your ad network confirms
 * a completed rewarded ad. For now the frontend calls them directly as a demo.
 * When you plug in AdMob/Unity/ironSource, call these endpoints only on "rewarded".
 */

/* ============================= */

router.post("/ads/points/claim", requireAuth, requireNotBanned, async (req, res) => {
  await ensureAdReset(req.user.id);

  const ur = await pool.query("SELECT level, points FROM users WHERE id=$1", [req.user.id]);
  const level = Number(ur.rows[0]?.level || 1);

  const tier = tierForLevel(level); // beginner | intermediate | pro
  const reward = Number(TIERS?.[tier]?.entryFee || 0);

  const lim = await pool.query("SELECT points_ads_used FROM ad_limits WHERE user_id=$1", [req.user.id]);
  const used = Number(lim.rows[0]?.points_ads_used || 0);
  if (used >= ADS_LIMITS.pointsPerDay) {
    return res.status(429).json({ error: "LIMIT_REACHED", used, limit: ADS_LIMITS.pointsPerDay });
  }

  await pool.query("UPDATE ad_limits SET points_ads_used=points_ads_used+1 WHERE user_id=$1", [req.user.id]);
  await pool.query("UPDATE users SET points=points+$2 WHERE id=$1", [req.user.id, reward]);

  const me = await pool.query("SELECT points FROM users WHERE id=$1", [req.user.id]);
  return res.json({ ok: true, tier, reward, used: used + 1, limit: ADS_LIMITS.pointsPerDay, points: me.rows[0].points });
});

router.post("/ads/crystals/claim", requireAuth, requireNotBanned, async (req, res) => {
  await ensureAdReset(req.user.id);

  const reward = 1;

  const lim = await pool.query("SELECT crystals_ads_used FROM ad_limits WHERE user_id=$1", [req.user.id]);
  const used = Number(lim.rows[0]?.crystals_ads_used || 0);
  if (used >= ADS_LIMITS.crystalsPerDay) {
    return res.status(429).json({ error: "LIMIT_REACHED", used, limit: ADS_LIMITS.crystalsPerDay });
  }

  await pool.query("UPDATE ad_limits SET crystals_ads_used=crystals_ads_used+1 WHERE user_id=$1", [req.user.id]);
  await pool.query("UPDATE users SET crystals=crystals+$2 WHERE id=$1", [req.user.id, reward]);

  const me = await pool.query("SELECT crystals FROM users WHERE id=$1", [req.user.id]);
  return res.json({ ok: true, reward, used: used + 1, limit: ADS_LIMITS.crystalsPerDay, crystals: me.rows[0].crystals });
});

export default router;
