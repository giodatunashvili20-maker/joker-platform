export function rateLimitGameResult(userId) {
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
