import { pool } from "../db.js";
import { todayISO } from "../utils/time.js";

export const ADS_LIMITS = {
  pointsPerDay: 10,
  crystalsPerDay: 5,
};

/**
 * Resets daily ad counters when date changes.
 * Uses ad_limits table created in initDb.
 */
export async function ensureAdReset(userId) {
  const today = todayISO();
  const r = await pool.query("SELECT * FROM ad_limits WHERE user_id=$1", [userId]);

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
