import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db.js";
import { requireAuth, requireNotBanned } from "../middleware/auth.js";
import { todayISO, weekKey, monthKey, yearKey } from "../utils/time.js";
import { rateLimitGameResult } from "../middleware/rateLimit.js";
import { xpDeltaByPlacement, lbDeltaByPlacement, levelFromXpTotal, xpProgress, getRankName } from "../config/economy.js";

const router = Router();

/* ============================= */

router.post("/game/result", requireAuth, requireNotBanned, async (req, res) => {
  const {
    gameType,
    placement,
    clientResultId,
    isRoom = false,
  } = req.body || {};

  const gt = String(gameType || "").toLowerCase();
  const p = Number(placement);

  if (!["joker", "bura", "nardi", "domino"].includes(gt)) return res.status(400).json({ error: "BAD_GAME_TYPE" });
  if (![1, 2, 3, 4].includes(p)) return res.status(400).json({ error: "BAD_PLACEMENT" });

  if (!isRoom) {
    if (!clientResultId || typeof clientResultId !== "string" || clientResultId.length < 16) {
      return res.status(400).json({ error: "MISSING_CLIENT_RESULT_ID" });
    }
    const lim = await rateLimitGameResult(req.user.id);
    if (!lim.ok) return res.status(429).json(lim);
  }

  const ur = await pool.query("SELECT xp_total, level FROM users WHERE id=$1", [req.user.id]);
  if (ur.rowCount === 0) return res.status(404).json({ error: "NOT_FOUND" });

  const currentXp = Number(ur.rows[0].xp_total || 0);
  const currentLevel = Number(ur.rows[0].level || 1);
  const tier = tierForLevel(currentLevel);

  const xpDelta = isRoom ? 0 : xpDeltaByPlacement(p);
  const lbDelta = isRoom ? 0 : lbDeltaByPlacement(p);

  const pointsDelta = isRoom ? 0 : (p === 1 ? TIERS[tier].winPoints : 0);
  const crystalsDelta = isRoom ? 0 : (p === 1 ? TIERS[tier].winCrystals : 0);

  const newXp = Math.max(0, currentXp + xpDelta);
  const newLevel = levelFromXpTotal(newXp);
  const progress = xpProgress(newXp);

  const gameId = uuidv4();

  try {
    await pool.query(
      `INSERT INTO games (
        id,user_id,game_type,placement,tier,
        xp_delta,lb_delta,points_delta,crystals_delta,
        client_result_id,ip,user_agent
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        gameId,
        req.user.id,
        gt,
        p,
        tier,
        xpDelta,
        lbDelta,
        pointsDelta,
        crystalsDelta,
        isRoom ? null : clientResultId,
        clientIp(req),
        userAgent(req),
      ]
    );
  } catch {
    return res.status(409).json({ error: "DUPLICATE_RESULT" });
  }

  await pool.query(
    "UPDATE users SET xp_total=$2, level=$3, points=points+$4, crystals=crystals+$5 WHERE id=$1",
    [req.user.id, newXp, newLevel, pointsDelta, crystalsDelta]
  );

  if (!isRoom) {
    const now = new Date();
    const periods = [
      { type: "daily", key: todayISO() },
      { type: "weekly", key: weekKey(now) },
      { type: "monthly", key: monthKey(now) },
      { type: "yearly", key: yearKey(now) },
    ];

    for (const per of periods) {
      await pool.query(
        `
        INSERT INTO leaderboard_scores (user_id, period_type, period_key, score, wins)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (user_id, period_type, period_key)
        DO UPDATE SET
          score = leaderboard_scores.score + EXCLUDED.score,
          wins = leaderboard_scores.wins + EXCLUDED.wins,
          updated_at = NOW()
        `,
        [req.user.id, per.type, per.key, lbDelta, p === 1 ? 1 : 0]
      );
    }
  }

  const me = await pool.query(
    "SELECT points, crystals FROM users WHERE id=$1",
    [req.user.id]
  );

  return res.json({
    ok: true,
    gameId,
    gameType: gt,
    placement: p,
    tier,
    isRoom: Boolean(isRoom),

    xpDelta,
    xpTotal: newXp,
    level: newLevel,
    rankName: getRankName(newLevel),
    xpCurrent: progress.currentLevelXp,
    xpNeeded: progress.neededForNext,
    xpPercent: progress.percent,

    leaderboardDelta: lbDelta,

    pointsDelta,
    crystalsDelta,
    points: me.rows[0].points,
    crystals: me.rows[0].crystals,
  });
});

/* ============================= */

export default router;
