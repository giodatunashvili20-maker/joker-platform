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

/* ============================= */
/* ===== Utility Functions ===== */
/* ============================= */

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

function monthKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function yearKey(d = new Date()) {
  return String(d.getFullYear());
}

// ISO week key: YYYY-Www
function weekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/* ============================= */
/* ========= XP Rules ========== */
/* ============================= */

function xpDeltaByPlacement(p) {
  if (p === 1) return 100;
  if (p === 2) return 70;
  if (p === 3) return 0;
  if (p === 4) return -20;
  throw new Error("BAD_PLACEMENT");
}

// Leaderboard score rules (separate from points)
function lbDeltaByPlacement(p) {
  if (p === 1) return 15;
  if (p === 2) return 10;
  return 0;
}

// Level curve
function xpNeededForNext(level) {
  return Math.floor(200 * Math.pow(level, 1.35));
}

// Total XP -> Level
function levelFromXpTotal(xpTotal) {
  let level = 1;
  let remaining = xpTotal;

  while (remaining >= xpNeededForNext(level)) {
    remaining -= xpNeededForNext(level);
    level += 1;
  }

  return level;
}

// XP progress inside current level (for progress bar)
function xpProgress(xpTotal) {
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

/* ============================= */
/* ========= Ranks ============= */
/* ============================= */

const RANKS = [
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

function getRankName(level) {
  let best = RANKS[0].name;
  for (const r of RANKS) if (level >= r.minLevel) best = r.name;
  return best;
}

/* ============================= */
/* ===== Database Init ========= */
/* ============================= */

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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ad_limits (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      points_ads_used INT NOT NULL DEFAULT 0,
      crystals_ads_used INT NOT NULL DEFAULT 0,
      last_reset_date DATE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_type TEXT NOT NULL,
      placement INT NOT NULL,
      xp_delta INT NOT NULL DEFAULT 0,
      lb_delta INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS leaderboard_scores (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      period_type TEXT NOT NULL,   -- daily/weekly/monthly/yearly
      period_key TEXT NOT NULL,    -- YYYY-MM-DD / YYYY-Www / YYYY-MM / YYYY
      score INT NOT NULL DEFAULT 0,
      wins INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, period_type, period_key)
    );
  `);
}

/* ============================= */
/* ============ AUTH =========== */
/* ============================= */

app.post("/auth/register", async (req, res) => {
  const { email, username, password } = req.body || {};
  if (!email || !username || !password) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }

  const id = uuidv4();
  const pass_hash = await bcrypt.hash(password, 10);

  try {
    await pool.query(
      "INSERT INTO users (id,email,username,pass_hash) VALUES ($1,$2,$3,$4)",
      [id, email, username, pass_hash]
    );
    return res.json({ token: signToken(id) });
  } catch {
    return res.status(409).json({ error: "USER_EXISTS" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }

  const r = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
  if (r.rowCount === 0) return res.status(401).json({ error: "INVALID_LOGIN" });

  const user = r.rows[0];
  const ok = await bcrypt.compare(password, user.pass_hash);
  if (!ok) return res.status(401).json({ error: "INVALID_LOGIN" });

  return res.json({ token: signToken(user.id) });
});

/* ============================= */
/* =========== PROFILE ========= */
/* ============================= */

app.get("/me", requireAuth, async (req, res) => {
  const r = await pool.query(
    "SELECT id,email,username,points,crystals,xp_total,level FROM users WHERE id=$1",
    [req.user.id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: "NOT_FOUND" });

  const me = r.rows[0];
  const progress = xpProgress(Number(me.xp_total));

  return res.json({
    ...me,
    rankName: getRankName(Number(me.level)),
    xpCurrent: progress.currentLevelXp,
    xpNeeded: progress.neededForNext,
    xpPercent: progress.percent,
  });
});

/* ============================= */
/* ===== GAME RESULT CORE ====== */
/* ============================= */

app.post("/game/result", requireAuth, async (req, res) => {
  const { gameType, placement } = req.body || {};
  const gt = String(gameType || "").toLowerCase();
  const p = Number(placement);

  if (!["joker", "bura", "nardi", "domino"].includes(gt)) {
    return res.status(400).json({ error: "BAD_GAME_TYPE" });
  }
  if (![1, 2, 3, 4].includes(p)) {
    return res.status(400).json({ error: "BAD_PLACEMENT" });
  }

  const xpDelta = xpDeltaByPlacement(p);
  const lbDelta = lbDeltaByPlacement(p);

  const userRow = await pool.query("SELECT xp_total FROM users WHERE id=$1", [
    req.user.id,
  ]);
  if (userRow.rowCount === 0) return res.status(404).json({ error: "NOT_FOUND" });

  const currentXp = Number(userRow.rows[0].xp_total);
  const newXp = Math.max(0, currentXp + xpDelta);
  const newLevel = levelFromXpTotal(newXp);
  const progress = xpProgress(newXp);

  const gameId = uuidv4();

  await pool.query(
    "INSERT INTO games (id,user_id,game_type,placement,xp_delta,lb_delta) VALUES ($1,$2,$3,$4,$5,$6)",
    [gameId, req.user.id, gt, p, xpDelta, lbDelta]
  );

  await pool.query("UPDATE users SET xp_total=$2, level=$3 WHERE id=$1", [
    req.user.id,
    newXp,
    newLevel,
  ]);

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

  return res.json({
    ok: true,
    gameId,
    gameType: gt,
    placement: p,
    xpDelta,
    xpTotal: newXp,
    level: newLevel,
    rankName: getRankName(newLevel),
    xpCurrent: progress.currentLevelXp,
    xpNeeded: progress.neededForNext,
    xpPercent: progress.percent,
    leaderboardDelta: lbDelta,
  });
});

/* ============================= */
/* ===== LEADERBOARD API ======= */
/* ============================= */

app.get("/leaderboard", async (req, res) => {
  const { period = "monthly", limit = 20 } = req.query;

  const p = String(period);
  const lim = Math.max(1, Math.min(200, Number(limit) || 20));

  const now = new Date();
  let key;

  if (p === "daily") key = todayISO();
  else if (p === "weekly") key = weekKey(now);
  else if (p === "monthly") key = monthKey(now);
  else if (p === "yearly") key = yearKey(now);
  else return res.status(400).json({ error: "BAD_PERIOD" });

  const r = await pool.query(
    `
    SELECT u.username, l.score, l.wins
    FROM leaderboard_scores l
    JOIN users u ON u.id = l.user_id
    WHERE l.period_type=$1 AND l.period_key=$2
    ORDER BY l.score DESC, l.wins DESC, u.username ASC
    LIMIT $3
    `,
    [p, key, lim]
  );

  return res.json({ period: p, key, rows: r.rows });
});

/* ============================= */
/* ========= START ============= */
/* ============================= */

initDb().then(() => {
  app.listen(PORT, () => console.log("API listening on", PORT));
});
