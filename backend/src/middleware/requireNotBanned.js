import { pool } from "../db.js";

export async function requireNotBanned(req, res, next) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }

    const r = await pool.query(
      `SELECT banned_until
       FROM users
       WHERE id = $1`,
      [userId]
    );

    const bannedUntil = r.rows[0]?.banned_until;

    if (bannedUntil && new Date(bannedUntil) > new Date()) {
      return res.status(403).json({
        error: "USER_BANNED",
        bannedUntil,
      });
    }

    next();
  } catch (e) {
    console.error("requireNotBanned error:", e);
    return res.status(500).json({ error: "BAN_CHECK_FAILED" });
  }
      }
