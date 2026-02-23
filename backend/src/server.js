import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { pool } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "change_me";
const PORT = process.env.PORT || 10000;

function signToken(id) {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: "7d" });
}

function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "NO_TOKEN" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "BAD_TOKEN" });
  }
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      pass_hash TEXT NOT NULL,
      points INT NOT NULL DEFAULT 0,
      crystals INT NOT NULL DEFAULT 0,
      xp_total INT NOT NULL DEFAULT 0,
      level INT NOT NULL DEFAULT 1,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      phone TEXT UNIQUE,
      phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ad_limits (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      points_ads_used INT NOT NULL DEFAULT 0,
      crystals_ads_used INT NOT NULL DEFAULT 0,
      last_reset_date DATE NOT NULL
    );
  `);
}

async function ensureAdReset(userId) {
  const today = todayISO();
  const r = await pool.query("SELECT * FROM ad_limits WHERE user_id=$1", [userId]);
  if (r.rowCount === 0) {
    await pool.query("INSERT INTO ad_limits (user_id, last_reset_date) VALUES ($1, $2)", [userId, today]);
    return;
  }
  if (String(r.rows[0].last_reset_date) !== today) {
    await pool.query(
      "UPDATE ad_limits SET points_ads_used=0, crystals_ads_used=0, last_reset_date=$2 WHERE user_id=$1",
      [userId, today]
    );
  }
}

app.get("/", (_, res) => res.send("Joker API OK"));

app.post("/auth/register", async (req, res) => {
  const { email, username, password } = req.body || {};
  if (!email || !username || !password) return res.status(400).json({ error: "MISSING_FIELDS" });

  const id = uuidv4();
  const pass_hash = await bcrypt.hash(password, 10);

  try {
    await pool.query("INSERT INTO users (id,email,username,pass_hash) VALUES ($1,$2,$3,$4)", [
      id,
      email,
      username,
      pass_hash,
    ]);
    await pool.query("INSERT INTO ad_limits (user_id, last_reset_date) VALUES ($1, $2)", [id, todayISO()]);
    return res.json({ token: signToken(id) });
  } catch {
    return res.status(409).json({ error: "USER_EXISTS" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "MISSING_FIELDS" });

  const r = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
  if (r.rowCount === 0) return res.status(401).json({ error: "INVALID_LOGIN" });

  const user = r.rows[0];
  const ok = await bcrypt.compare(password, user.pass_hash);
  if (!ok) return res.status(401).json({ error: "INVALID_LOGIN" });

  return res.json({ token: signToken(user.id) });
});

app.get("/me", requireAuth, async (req, res) => {
  const r = await pool.query(
    "SELECT id,email,username,points,crystals,xp_total,level,email_verified,phone_verified,phone FROM users WHERE id=$1",
    [req.user.id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json(r.rows[0]);
});

app.post("/ads/points/claim", requireAuth, async (req, res) => {
  await ensureAdReset(req.user.id);

  const lim = await pool.query("SELECT * FROM ad_limits WHERE user_id=$1", [req.user.id]);
  if (lim.rows[0].points_ads_used >= 10) return res.status(429).json({ error: "LIMIT_REACHED", limit: 10 });

  const reward = Number(req.body?.reward || 100);

  await pool.query("UPDATE ad_limits SET points_ads_used=points_ads_used+1 WHERE user_id=$1", [req.user.id]);
  await pool.query("UPDATE users SET points=points+$2 WHERE id=$1", [req.user.id, reward]);

  const u = await pool.query("SELECT points FROM users WHERE id=$1", [req.user.id]);
  return res.json({ ok: true, used: lim.rows[0].points_ads_used + 1, limit: 10, points: u.rows[0].points });
});

app.post("/ads/crystals/claim", requireAuth, async (req, res) => {
  await ensureAdReset(req.user.id);

  const lim = await pool.query("SELECT * FROM ad_limits WHERE user_id=$1", [req.user.id]);
  if (lim.rows[0].crystals_ads_used >= 5) return res.status(429).json({ error: "LIMIT_REACHED", limit: 5 });

  const reward = Number(req.body?.reward || 3);

  await pool.query("UPDATE ad_limits SET crystals_ads_used=crystals_ads_used+1 WHERE user_id=$1", [req.user.id]);
  await pool.query("UPDATE users SET crystals=crystals+$2 WHERE id=$1", [req.user.id, reward]);

  const u = await pool.query("SELECT crystals FROM users WHERE id=$1", [req.user.id]);
  return res.json({ ok: true, used: lim.rows[0].crystals_ads_used + 1, limit: 5, crystals: u.rows[0].crystals });
});

initDb().then(() => {
  app.listen(PORT, () => console.log("API listening on", PORT));
});
