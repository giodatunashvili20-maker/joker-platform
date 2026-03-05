import { Router } from "express";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db.js";
import { signToken } from "../middleware/auth.js";

const router = Router();

/* ============================= */

router.post("/auth/register", async (req, res) => {
  const { email, username, password } = req.body || {};
  if (!email || !username || !password)
    return res.status(400).json({ error: "MISSING_FIELDS" });

  const id = uuidv4();
  const pass_hash = await bcrypt.hash(password, 10);

  try {
    await pool.query(
      "INSERT INTO users (id,email,username,pass_hash) VALUES ($1,$2,$3,$4)",
      [id, email, username, pass_hash]
    );
    await pool.query(
      "INSERT INTO ad_limits (user_id,last_reset_date) VALUES ($1,$2)",
      [id, todayISO()]
    );
    return res.json({ token: signToken(id) });
  } catch {
    return res.status(409).json({ error: "USER_EXISTS" });
  }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
if (!email || !password) {
  return res.status(400).json({ error: "MISSING_FIELDS" });
}
  const r = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
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
      level: user.level,
      rank: getRankName(user.level),
      xp: user.xp_total,
      points: user.points,
      crystals: user.crystals
    }
  });
});

/* ============================= */

export default router;
