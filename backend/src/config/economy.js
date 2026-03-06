// XP: 1:+100, 2:+70, 3:0, 4:-20 (XP only)
export function xpDeltaByPlacement(p) {
  if (p === 1) return 100;
  if (p === 2) return 70;
  if (p === 3) return 0;
  if (p === 4) return -20;
  throw new Error("BAD_PLACEMENT");
}

// Leaderboard score rules (separate from points)
export function lbDeltaByPlacement(p) {
  if (p === 1) return 15;
  if (p === 2) return 10;
  return 0;
}

// Level curve
export function xpNeededForNext(level) {
  return Math.floor(200 * Math.pow(level, 1.35));
}

export function levelFromXpTotal(xpTotal) {
  let level = 1;
  let remaining = xpTotal;

  while (remaining >= xpNeededForNext(level)) {
    remaining -= xpNeededForNext(level);
    level += 1;
  }
  return level;
}

export function xpProgress(xpTotal) {
  let level = 1;
  let remaining = xpTotal;

  while (remaining >= xpNeededForNext(level)) {
    remaining -= xpNeededForNext(level);
    level += 1;
  }

  const needed = xpNeededForNext(level);
  const percent = needed > 0 ? Math.floor((remaining / needed) * 100) : 0;

  return {
    currentLevelXp: remaining,
    neededForNext: needed,
    percent,
  };
}

export const RANKS = [
  { name: "ახალბედა", minLevel: 1 },
  { name: "მოსწავლე", minLevel: 5 },
  { name: "გამოცდილი", minLevel: 9 },
  { name: "ოსტატი", minLevel: 14 },
  { name: "დიდოსტატი", minLevel: 19 },
  { name: "სტრატეგი", minLevel: 25 },
  { name: "მაესტრო", minLevel: 32 },
  { name: "ჩემპიონი", minLevel: 40 },
  { name: "ლეგენდა", minLevel: 49 },
  { name: "The Joker King", minLevel: 61 },
];

export function getRankName(level) {
  let best = RANKS[0].name;
  for (const r of RANKS) if (level >= r.minLevel) best = r.name;
  return best;
}


/* ============================= */
/* ========= ECONOMY =========== */
/* ============================= */

// One-table matchmaking; backend chooses tier by user level.
// Entry fees:
export const TIERS = {
  beginner: { entryFee: 100, minLevel: 1, winPoints: 5, winCrystals: 3 },
  intermediate: { entryFee: 250, minLevel: 9, winPoints: 7, winCrystals: 6 },
  pro: { entryFee: 500, minLevel: 19, winPoints: 10, winCrystals: 10 },
};

export function tierForLevel(level) {
  if (level >= TIERS.pro.minLevel) return "pro";
  if (level >= TIERS.intermediate.minLevel) return "intermediate";
  return "beginner";
}

// Ads limits
const ADS_LIMITS = {
  pointsPerDay: 10,
  crystalsPerDay: 5,
};

// Anti-cheat basic rate limit (per-user)
async function rateLimitGameResult(userId) {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS c
     FROM games
     WHERE user_id=$1 AND created_at > NOW() - INTERVAL '1 minute'`,
    [userId]
  );
  if (Number(r.rows[0].c) >= 6) {
    return { ok: false, error: "RATE_LIMIT", retryAfterSec: 60 };
  }
  return { ok: true };
}

async function ensureAdReset(userId) {
  const today = todayISO();
  const r = await pool.query("SELECT * FROM ad_limits WHERE user_id=$1", [
    userId,
  ]);
  if (r.rowCount === 0) {
    await pool.query(
      "INSERT INTO ad_limits (user_id, last_reset_date) VALUES ($1,$2)",
      [userId, today]
    );
    return;
  }
  if (String(r.rows[0].last_reset_date) !== today) {
    await pool.query(
      "UPDATE ad_limits SET points_ads_used=0, crystals_ads_used=0, last_reset_date=$2 WHERE user_id=$1",
      [userId, today]
    );
  }
}
