import { Router } from "express";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db.js";
import { signToken } from "../middleware/auth.js";
import { getRankName } from "../config/economy.js";

const router = Router();

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ============================= */

router.post("/auth/register", async (req, res) => {
  const { email, username, password } = req.body || {};

  if (!email || !username || !password) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedUsername = String(username).trim();

  const id = uuidv4();
  const pass_hash = await bcrypt.hash(password, 10);

  try {
    const existing = await pool.query(
      "SELECT id FROM users WHERE email=$1 OR username=$2",
      [normalizedEmail, normalizedUsername]
    );

    if (existing.rowCount) {
      return res.status(409).json({ error: "USER_EXISTS" });
    }

    await pool.query(
      "INSERT INTO users (id,email,username,pass_hash) VALUES ($1,$2,$3,$4)",
      [id, normalizedEmail, normalizedUsername, pass_hash]
    );

    await pool.query(
      "INSERT INTO ad_limits (user_id,last_reset_date) VALUES ($1,$2)",
      [id, todayISO()]
    );

    return res.json({
      token: signToken(id),
      user: {
        id,
        email: normalizedEmail,
        username: normalizedUsername,
        level: 1,
        rank: getRankName(1),
        xp: 0,
        points: 0,
        crystals: 0,
      },
    });
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    return res.status(500).json({
      error: "REGISTER_FAILED",
      message: e.message,
    });
  }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const r = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [normalizedEmail]
  );

  if (!r.rowCount) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  const user = r.rows[0];

  const ok = await bcrypt.compare(password, user.pass_hash);
  if (!ok) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  const token = signToken(user.id);

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      level: user.level ?? 1,
      rank: getRankName(user.level ?? 1),
      xp: user.xp_total ?? 0,
      points: user.points ?? 0,
      crystals: user.crystals ?? 0,
    },
  });
});

/* ============================= */

export default router;
