import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { pool } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "change_me";
const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = process.env.PORT || 10000;

/* ============================= */
/* ========= HELPERS =========== */
/* ============================= */

function signToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "7d" });
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

async function requireNotBanned(req, res, next) {
  const r = await pool.query("SELECT ban_until FROM users WHERE id=$1", [
    req.user.id,
  ]);
  const banUntil = r.rows[0]?.ban_until;
  if (banUntil && new Date(banUntil).getTime() > Date.now()) {
    return res.status(403).json({ error: "BANNED", banUntil });
  }
  return next();
}

function nowISO() {
  return new Date().toISOString();
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

function randCode6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function clientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
    req.socket.remoteAddress ||
    ""
  ).trim();
}

function userAgent(req) {
  return String(req.headers["user-agent"] || "");
}

/* ============================= */
/* ====== XP / LEVEL / RANK ==== */
/* ============================= */

// XP: 1:+100, 2:+70, 3:0, 4:-20 (XP only)
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

function levelFromXpTotal(xpTotal) {
  let level = 1;
  let remaining = xpTotal;

  while (remaining >= xpNeededForNext(level)) {
    remaining -= xpNeededForNext(level);
    level += 1;
  }
  return level;
}

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
/* ========= ECONOMY =========== */
/* ============================= */

// One-table matchmaking; backend chooses tier by user level.
// Entry fees:
const TIERS = {
  beginner: { entryFee: 100, minLevel: 1, winPoints: 5, winCrystals: 3 },
  intermediate: { entryFee: 250, minLevel: 9, winPoints: 7, winCrystals: 6 },
  pro: { entryFee: 500, minLevel: 19, winPoints: 10, winCrystals: 10 },
};

function tierForLevel(level) {
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

/* ============================= */
/* ======== DB INIT ============ */
/* ============================= */

async function initDb() {
  await pool.query(`
    /* ================= USERS ================= */
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

      -- quit penalties / bans
      leave_strikes INT NOT NULL DEFAULT 0,
      ban_until TIMESTAMPTZ,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    /* ================= AD LIMITS ================= */
    CREATE TABLE IF NOT EXISTS ad_limits (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      points_ads_used INT NOT NULL DEFAULT 0,
      crystals_ads_used INT NOT NULL DEFAULT 0,
      last_reset_date DATE NOT NULL
    );

    /* ================= LEADERBOARD ================= */
    CREATE TABLE IF NOT EXISTS leaderboard_scores (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      period_type TEXT NOT NULL,   -- daily/weekly/monthly/yearly
      period_key TEXT NOT NULL,    -- YYYY-MM-DD / YYYY-Www / YYYY-MM / YYYY
      score INT NOT NULL DEFAULT 0,
      wins INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, period_type, period_key)
    );

    /* ================= SHOP ================= */
    CREATE TABLE IF NOT EXISTS shop_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,          -- card_back/avatar_frame/table_theme/emote
      name TEXT NOT NULL,
      description TEXT,
      price_crystals INT NOT NULL DEFAULT 0,
      asset_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_inventory (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
      acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, item_id)
    );

    /* ================= ADMIN ================= */
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      pass_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    /* ================= VERIFICATIONS ================= */
    CREATE TABLE IF NOT EXISTS verifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,              -- email/phone
      target TEXT NOT NULL,            -- email or phone
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    /* ================= FRIENDS + DM CHAT ================= */
    CREATE TABLE IF NOT EXISTS friend_requests (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending', -- pending/accepted/rejected
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS friendships (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, friend_id)
    );

    CREATE TABLE IF NOT EXISTS dm_messages (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'text', -- text/emoji/emote/gif
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    /* ================= ROOMS ================= */
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      host_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      game_type TEXT NOT NULL,          -- joker/bura/nardi/domino
      is_private BOOLEAN NOT NULL DEFAULT TRUE,
      join_code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    /* ================= BOTS ================= */
    CREATE TABLE IF NOT EXISTS bots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      difficulty INT NOT NULL DEFAULT 1,  -- 1 easy / 2 mid / 3 hard
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    /* ================= ROOM MEMBERS (FIXED) ================= */
    CREATE TABLE IF NOT EXISTS room_members (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,

      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      bot_id TEXT REFERENCES bots(id) ON DELETE CASCADE,

      mic_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      muted BOOLEAN NOT NULL DEFAULT FALSE,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CHECK (
        (user_id IS NOT NULL AND bot_id IS NULL)
        OR
        (user_id IS NULL AND bot_id IS NOT NULL)
      )
    );

    CREATE UNIQUE INDEX IF NOT EXISTS room_members_room_user_uidx
    ON room_members(room_id, user_id)
    WHERE user_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS room_members_room_bot_uidx
    ON room_members(room_id, bot_id)
    WHERE bot_id IS NOT NULL;

    /* ================= ROOM MESSAGES ================= */
    CREATE TABLE IF NOT EXISTS room_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,

      from_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      from_bot_id TEXT REFERENCES bots(id) ON DELETE CASCADE,

      kind TEXT NOT NULL DEFAULT 'text', -- text/emoji/emote/gif
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CHECK (
        (from_user_id IS NOT NULL AND from_bot_id IS NULL)
        OR
        (from_user_id IS NULL AND from_bot_id IS NOT NULL)
      )
    );

    /* ================= MATCHMAKING QUEUE ================= */
    CREATE TABLE IF NOT EXISTS matchmaking_queue (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_type TEXT NOT NULL,   -- joker/bura/nardi/domino
      mode TEXT NOT NULL,        -- ones/nines for joker, else default
      xishte INT NOT NULL DEFAULT 1, -- 1..3
      delete_scope TEXT NOT NULL DEFAULT 'last', -- last/all
      tier TEXT NOT NULL,        -- beginner/intermediate/pro
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, game_type)
    );

    /* ================= GAMES (MATCHES YOUR SERVER.JS) ================= */
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

      game_type TEXT NOT NULL,               -- joker/bura/nardi/domino
      placement INT NOT NULL CHECK (placement BETWEEN 1 AND 4),

      tier TEXT,                             -- beginner/intermediate/pro

      xp_delta INT NOT NULL DEFAULT 0,
      lb_delta INT NOT NULL DEFAULT 0,

      points_delta INT NOT NULL DEFAULT 0,   -- gameplay points (not ads)
      crystals_delta INT NOT NULL DEFAULT 0, -- gameplay crystals

      client_result_id TEXT,
      ip TEXT,
      user_agent TEXT,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  /* ===== Migration safety for existing DBs ===== */

  // Ensure anti-cheat column exists even if games was created earlier without it
  await pool.query(`
    ALTER TABLE games
    ADD COLUMN IF NOT EXISTS client_result_id TEXT;
  `);

  await pool.query(`
    ALTER TABLE games
    ADD COLUMN IF NOT EXISTS ip TEXT;
  `);

  await pool.query(`
    ALTER TABLE games
    ADD COLUMN IF NOT EXISTS user_agent TEXT;
  `);

  // Ensure ban columns exist on older users table
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS leave_strikes INT NOT NULL DEFAULT 0;
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS ban_until TIMESTAMPTZ;
  `);

  /* ===== Anti-cheat unique index ===== */
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS games_user_client_result_uidx
    ON games(user_id, client_result_id)
    WHERE client_result_id IS NOT NULL;
  `);
}

/* ============================= */
/* ============ ROOT =========== */
/* ============================= */

app.get("/health", (_, res) => res.json({ ok: true, ts: nowISO() }));

/* ============================= */
/* ============ AUTH =========== */
/* ============================= */

app.post("/auth/register", async (req, res) => {
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

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const r = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  if (!r.rowCount) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  const user = r.rows[0];

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

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
/* ============ ME ============= */
/* ============================= */

app.get("/me", requireAuth, async (req, res) => {
  const r = await pool.query(
    "SELECT id,email,username,points,crystals,xp_total,level,email_verified,phone,phone_verified,leave_strikes,ban_until FROM users WHERE id=$1",
    [req.user.id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: "NOT_FOUND" });

  const me = r.rows[0];
  const progress = xpProgress(Number(me.xp_total));
  const level = Number(me.level);

  return res.json({
    ...me,
    tier: tierForLevel(level),
    rankName: getRankName(level),
    xpCurrent: progress.currentLevelXp,
    xpNeeded: progress.neededForNext,
    xpPercent: progress.percent,
  });
});

/* ============================= */
/* ========= BAN SYSTEM ======== */
/* ============================= */

// Call this when player quits/leaves a REAL (non-room) public match.
// Escalation: 1h, 2h, 4h, 8h...
app.post("/penalties/left-game", requireAuth, async (req, res) => {
  const u = await pool.query("SELECT leave_strikes FROM users WHERE id=$1", [
    req.user.id,
  ]);
  const strikes = Number(u.rows[0]?.leave_strikes || 0) + 1;
  const banHours = Math.pow(2, strikes - 1);
  const banUntil = new Date(Date.now() + banHours * 60 * 60 * 1000);

  await pool.query(
    "UPDATE users SET leave_strikes=$2, ban_until=$3 WHERE id=$1",
    [req.user.id, strikes, banUntil.toISOString()]
  );

  return res.json({ ok: true, strikes, banHours, banUntil });
});

/* ============================= */
/* ======= VERIFICATION ======== */
/* ============================= */

// DEV-ში code დაბრუნდება response-ში; PROD-ში ჩაანაცვლებ provider-ით
app.post("/verify/request-email", requireAuth, async (req, res) => {
  const userR = await pool.query("SELECT email FROM users WHERE id=$1", [
    req.user.id,
  ]);
  const email = userR.rows[0]?.email;
  if (!email) return res.status(400).json({ error: "NO_EMAIL" });

  const code = randCode6();
  const id = uuidv4();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await pool.query(
    "INSERT INTO verifications (id,user_id,kind,target,code_hash,expires_at) VALUES ($1,$2,'email',$3,$4,$5)",
    [id, req.user.id, email, sha256(code), expiresAt]
  );

  return res.json({
    ok: true,
    expiresAt,
    ...(NODE_ENV !== "production" ? { devCode: code } : {}),
  });
});

app.post("/verify/confirm-email", requireAuth, async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: "MISSING_CODE" });

  const v = await pool.query(
    `
    SELECT * FROM verifications
    WHERE user_id=$1 AND kind='email' AND used=FALSE AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [req.user.id]
  );
  if (v.rowCount === 0)
    return res.status(400).json({ error: "NO_ACTIVE_VERIFICATION" });

  const row = v.rows[0];
  if (sha256(String(code)) !== row.code_hash)
    return res.status(400).json({ error: "BAD_CODE" });

  await pool.query("UPDATE verifications SET used=TRUE WHERE id=$1", [row.id]);
  await pool.query("UPDATE users SET email_verified=TRUE WHERE id=$1", [
    req.user.id,
  ]);

  return res.json({ ok: true });
});

app.post("/verify/request-phone", requireAuth, async (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: "MISSING_PHONE" });

  await pool.query("UPDATE users SET phone=$2, phone_verified=FALSE WHERE id=$1", [
    req.user.id,
    phone,
  ]);

  const code = randCode6();
  const id = uuidv4();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await pool.query(
    "INSERT INTO verifications (id,user_id,kind,target,code_hash,expires_at) VALUES ($1,$2,'phone',$3,$4,$5)",
    [id, req.user.id, phone, sha256(code), expiresAt]
  );

  return res.json({
    ok: true,
    expiresAt,
    ...(NODE_ENV !== "production" ? { devCode: code } : {}),
  });
});

app.post("/verify/confirm-phone", requireAuth, async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: "MISSING_CODE" });

  const v = await pool.query(
    `
    SELECT * FROM verifications
    WHERE user_id=$1 AND kind='phone' AND used=FALSE AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [req.user.id]
  );
  if (v.rowCount === 0)
    return res.status(400).json({ error: "NO_ACTIVE_VERIFICATION" });

  const row = v.rows[0];
  if (sha256(String(code)) !== row.code_hash)
    return res.status(400).json({ error: "BAD_CODE" });

  await pool.query("UPDATE verifications SET used=TRUE WHERE id=$1", [row.id]);
  await pool.query("UPDATE users SET phone_verified=TRUE WHERE id=$1", [
    req.user.id,
  ]);

  return res.json({ ok: true });
});

/* ============================= */
/* ======== ADS REWARDS ======== */
/* ============================= */

app.post("/ads/points/claim", requireAuth, requireNotBanned, async (req, res) => {
  await ensureAdReset(req.user.id);

  const ur = await pool.query("SELECT level FROM users WHERE id=$1", [req.user.id]);
  const level = Number(ur.rows[0]?.level || 1);
  const tier = tierForLevel(level);
  const reward = TIERS[tier].entryFee;

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

app.post("/ads/crystals/claim", requireAuth, requireNotBanned, async (req, res) => {
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

/* ============================= */
/* ===== MATCHMAKING QUEUE ===== */
/* ============================= */

app.post("/matchmaking/join", requireAuth, requireNotBanned, async (req, res) => {
  const { gameType, mode, xishte = 1, deleteScope = "last" } = req.body || {};
  const gt = String(gameType || "").toLowerCase();
  const md = String(mode || "").toLowerCase();
  const xs = Number(xishte);

  if (!["joker", "bura", "nardi", "domino"].includes(gt)) return res.status(400).json({ error: "BAD_GAME_TYPE" });
  if (gt === "joker" && !["ones", "nines"].includes(md)) return res.status(400).json({ error: "BAD_MODE" });
  if (![1, 2, 3].includes(xs)) return res.status(400).json({ error: "BAD_XISHTE" });
  if (!["last", "all"].includes(deleteScope)) return res.status(400).json({ error: "BAD_DELETE_SCOPE" });

  const ur = await pool.query("SELECT level FROM users WHERE id=$1", [req.user.id]);
  const level = Number(ur.rows[0]?.level || 1);
  const tier = tierForLevel(level);

  const id = uuidv4();
  await pool.query(
    `
    INSERT INTO matchmaking_queue (id,user_id,game_type,mode,xishte,delete_scope,tier)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (user_id, game_type)
    DO UPDATE SET mode=EXCLUDED.mode, xishte=EXCLUDED.xishte, delete_scope=EXCLUDED.delete_scope, tier=EXCLUDED.tier, created_at=NOW()
    `,
    [id, req.user.id, gt, gt === "joker" ? md : "default", xs, deleteScope, tier]
  );

  const cnt = await pool.query(
    `SELECT COUNT(*)::int AS c FROM matchmaking_queue WHERE game_type=$1 AND mode=$2 AND tier=$3`,
    [gt, gt === "joker" ? md : "default", tier]
  );

  return res.json({ ok: true, gameType: gt, mode: gt === "joker" ? md : "default", xishte: xs, deleteScope, tier, waiting: cnt.rows[0].c });
});

app.post("/matchmaking/leave", requireAuth, async (req, res) => {
  const { gameType } = req.body || {};
  const gt = String(gameType || "").toLowerCase();
  if (!["joker", "bura", "nardi", "domino"].includes(gt)) return res.status(400).json({ error: "BAD_GAME_TYPE" });

  await pool.query("DELETE FROM matchmaking_queue WHERE user_id=$1 AND game_type=$2", [req.user.id, gt]);
  return res.json({ ok: true });
});

/* ============================= */
/* ===== GAME RESULT + ANTI ===== */
/* ============================= */

app.post("/game/result", requireAuth, requireNotBanned, async (req, res) => {
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
/* ======= LEADERBOARDS ======== */
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

app.get("/me/leaderboards", requireAuth, async (req, res) => {
  const now = new Date();
  const periods = [
    { period: "daily", key: todayISO() },
    { period: "weekly", key: weekKey(now) },
    { period: "monthly", key: monthKey(now) },
    { period: "yearly", key: yearKey(now) },
  ];

  const out = {};
  for (const p of periods) {
    const r = await pool.query(
      `SELECT score, wins FROM leaderboard_scores WHERE user_id=$1 AND period_type=$2 AND period_key=$3`,
      [req.user.id, p.period, p.key]
    );
    out[p.period] = {
      key: p.key,
      score: r.rowCount ? Number(r.rows[0].score) : 0,
      wins: r.rowCount ? Number(r.rows[0].wins) : 0,
    };
  }
  return res.json(out);
});

/* ============================= */
/* ========= SHOP USER ========= */
/* ============================= */

app.get("/shop/items", requireAuth, async (_req, res) => {
  const r = await pool.query(
    "SELECT id,type,name,description,price_crystals,asset_url FROM shop_items WHERE is_active=TRUE ORDER BY created_at DESC"
  );
  return res.json({ items: r.rows });
});

app.get("/shop/inventory", requireAuth, async (req, res) => {
  const r = await pool.query(
    `
    SELECT si.id, si.type, si.name, si.description, si.asset_url, ui.acquired_at
    FROM user_inventory ui
    JOIN shop_items si ON si.id = ui.item_id
    WHERE ui.user_id=$1
    ORDER BY ui.acquired_at DESC
    `,
    [req.user.id]
  );
  return res.json({ items: r.rows });
});

app.post("/shop/buy", requireAuth, async (req, res) => {
  const { itemId } = req.body || {};
  if (!itemId) return res.status(400).json({ error: "MISSING_ITEM_ID" });

  const itemR = await pool.query(
    "SELECT id, price_crystals, is_active FROM shop_items WHERE id=$1",
    [itemId]
  );
  if (itemR.rowCount === 0) return res.status(404).json({ error: "ITEM_NOT_FOUND" });
  if (!itemR.rows[0].is_active) return res.status(400).json({ error: "ITEM_INACTIVE" });

  const price = Number(itemR.rows[0].price_crystals || 0);

  const ur = await pool.query("SELECT crystals FROM users WHERE id=$1", [req.user.id]);
  const crystals = Number(ur.rows[0]?.crystals || 0);
  if (crystals < price) return res.status(400).json({ error: "NOT_ENOUGH_CRYSTALS" });

  const own = await pool.query(
    "SELECT 1 FROM user_inventory WHERE user_id=$1 AND item_id=$2",
    [req.user.id, itemId]
  );
  if (own.rowCount) return res.status(409).json({ error: "ALREADY_OWNED" });

  await pool.query("UPDATE users SET crystals=crystals-$2 WHERE id=$1", [req.user.id, price]);
  await pool.query("INSERT INTO user_inventory (user_id,item_id) VALUES ($1,$2)", [req.user.id, itemId]);

  const me = await pool.query("SELECT crystals FROM users WHERE id=$1", [req.user.id]);
  return res.json({ ok: true, crystals: me.rows[0].crystals });
});

/* ============================= */
/* ========= FRIENDS/DM ========= */
/* ============================= */

app.get("/users/search", requireAuth, async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ users: [] });

  const r = await pool.query(
    `SELECT id, username FROM users WHERE username ILIKE $1 ORDER BY username ASC LIMIT 20`,
    [`%${q}%`]
  );
  return res.json({ users: r.rows });
});

app.post("/friends/request", requireAuth, async (req, res) => {
  const { toUserId } = req.body || {};
  if (!toUserId) return res.status(400).json({ error: "MISSING_TO_USER" });
  if (toUserId === req.user.id) return res.status(400).json({ error: "CANNOT_FRIEND_SELF" });

  const fr = await pool.query(
    "SELECT 1 FROM friendships WHERE user_id=$1 AND friend_id=$2",
    [req.user.id, toUserId]
  );
  if (fr.rowCount) return res.status(409).json({ error: "ALREADY_FRIENDS" });

  const id = uuidv4();
  await pool.query(
    "INSERT INTO friend_requests (id,from_user_id,to_user_id,status) VALUES ($1,$2,$3,'pending')",
    [id, req.user.id, toUserId]
  );

  return res.json({ ok: true, requestId: id });
});

app.get("/friends/requests", requireAuth, async (req, res) => {
  const r = await pool.query(
    `
    SELECT fr.id, fr.status, fr.created_at, u.id AS from_id, u.username AS from_username
    FROM friend_requests fr
    JOIN users u ON u.id = fr.from_user_id
    WHERE fr.to_user_id=$1 AND fr.status='pending'
    ORDER BY fr.created_at DESC
    `,
    [req.user.id]
  );
  return res.json({ requests: r.rows });
});

app.post("/friends/respond", requireAuth, async (req, res) => {
  const { requestId, action } = req.body || {};
  if (!requestId || !["accept", "reject"].includes(String(action)))
    return res.status(400).json({ error: "BAD_REQUEST" });

  const r = await pool.query(
    "SELECT * FROM friend_requests WHERE id=$1 AND to_user_id=$2",
    [requestId, req.user.id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: "REQUEST_NOT_FOUND" });
  if (r.rows[0].status !== "pending") return res.status(400).json({ error: "ALREADY_DECIDED" });

  if (action === "reject") {
    await pool.query("UPDATE friend_requests SET status='rejected' WHERE id=$1", [requestId]);
    return res.json({ ok: true });
  }

  const fromId = r.rows[0].from_user_id;
  await pool.query("UPDATE friend_requests SET status='accepted' WHERE id=$1", [requestId]);

  await pool.query(
    "INSERT INTO friendships (user_id, friend_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
    [req.user.id, fromId]
  );
  await pool.query(
    "INSERT INTO friendships (user_id, friend_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
    [fromId, req.user.id]
  );

  return res.json({ ok: true });
});

app.get("/friends/list", requireAuth, async (req, res) => {
  const r = await pool.query(
    `
    SELECT u.id, u.username
    FROM friendships f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id=$1
    ORDER BY u.username ASC
    `,
    [req.user.id]
  );
  return res.json({ friends: r.rows });
});

app.post("/chat/dm/send", requireAuth, async (req, res) => {
  const { toUserId, kind = "text", content } = req.body || {};
  if (!toUserId || !content) return res.status(400).json({ error: "MISSING_FIELDS" });
  if (!["text", "emoji", "emote", "gif"].includes(kind)) return res.status(400).json({ error: "BAD_KIND" });

  const fr = await pool.query(
    "SELECT 1 FROM friendships WHERE user_id=$1 AND friend_id=$2",
    [req.user.id, toUserId]
  );
  if (!fr.rowCount) return res.status(403).json({ error: "NOT_FRIENDS" });

  const id = uuidv4();
  await pool.query(
    "INSERT INTO dm_messages (id,from_user_id,to_user_id,kind,content) VALUES ($1,$2,$3,$4,$5)",
    [id, req.user.id, toUserId, kind, String(content)]
  );
  return res.json({ ok: true, id });
});

app.get("/chat/dm/history", requireAuth, async (req, res) => {
  const withUserId = String(req.query.withUserId || "");
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
  if (!withUserId) return res.status(400).json({ error: "MISSING_WITH_USER" });

  const fr = await pool.query(
    "SELECT 1 FROM friendships WHERE user_id=$1 AND friend_id=$2",
    [req.user.id, withUserId]
  );
  if (!fr.rowCount) return res.status(403).json({ error: "NOT_FRIENDS" });

  const r = await pool.query(
    `
    SELECT id, from_user_id, to_user_id, kind, content, created_at
    FROM dm_messages
    WHERE (from_user_id=$1 AND to_user_id=$2) OR (from_user_id=$2 AND to_user_id=$1)
    ORDER BY created_at DESC
    LIMIT $3
    `,
    [req.user.id, withUserId, limit]
  );
  return res.json({ messages: r.rows.reverse() });
});

/* ============================= */
/* ============ ROOMS =========== */
/* ============================= */

function makeJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

app.post("/rooms/create", requireAuth, requireNotBanned, async (req, res) => {
  const { name, gameType, isPrivate = true } = req.body || {};
  const gt = String(gameType || "").toLowerCase();
  if (!name || !gt) return res.status(400).json({ error: "MISSING_FIELDS" });
  if (!["joker", "bura", "nardi", "domino"].includes(gt)) return res.status(400).json({ error: "BAD_GAME_TYPE" });

  const id = uuidv4();
  const joinCode = isPrivate ? makeJoinCode() : null;

  await pool.query(
    "INSERT INTO rooms (id,host_user_id,name,game_type,is_private,join_code) VALUES ($1,$2,$3,$4,$5,$6)",
    [id, req.user.id, name, gt, Boolean(isPrivate), joinCode]
  );

  await pool.query(
  "INSERT INTO room_members (id, room_id, user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
  [uuidv4(), id, req.user.id]
);

  return res.json({ ok: true, roomId: id, joinCode });
});

app.post("/rooms/join", requireAuth, requireNotBanned, async (req, res) => {
  const { roomId, joinCode } = req.body || {};
  if (!roomId) return res.status(400).json({ error: "MISSING_ROOM_ID" });

  const r = await pool.query("SELECT * FROM rooms WHERE id=$1", [roomId]);
  if (!r.rowCount) return res.status(404).json({ error: "ROOM_NOT_FOUND" });

  const room = r.rows[0];
  if (room.is_private && String(joinCode || "").toUpperCase() !== String(room.join_code || "").toUpperCase()) {
    return res.status(403).json({ error: "BAD_JOIN_CODE" });
  }

  await pool.query(
  "INSERT INTO room_members (id, room_id, user_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
  [uuidv4(), roomId, req.user.id]
);

  return res.json({ ok: true });
});

app.post("/rooms/leave", requireAuth, async (req, res) => {
  const { roomId } = req.body || {};
  if (!roomId) return res.status(400).json({ error: "MISSING_ROOM_ID" });

  await pool.query("DELETE FROM room_members WHERE room_id=$1 AND user_id=$2", [roomId, req.user.id]);
  return res.json({ ok: true });
});

app.get("/rooms/mine", requireAuth, async (req, res) => {
  const r = await pool.query(
    `
    SELECT rm.room_id, r.name, r.game_type, r.is_private, r.join_code, r.host_user_id
    FROM room_members rm
    JOIN rooms r ON r.id = rm.room_id
    WHERE rm.user_id=$1
    ORDER BY r.created_at DESC
    `,
    [req.user.id]
  );
  return res.json({ rooms: r.rows });
});

// Replace current user with AI bot in room (scaffolding + persistence)
app.post("/rooms/replace-me-with-bot", requireAuth, async (req, res) => {
  const { roomId } = req.body || {};
  if (!roomId) return res.status(400).json({ error: "MISSING_ROOM_ID" });

  const m = await pool.query(
    "SELECT 1 FROM room_members WHERE room_id=$1 AND user_id=$2",
    [roomId, req.user.id]
  );
  if (!m.rowCount) return res.status(403).json({ error: "NOT_IN_ROOM" });

  const ur = await pool.query("SELECT level FROM users WHERE id=$1", [req.user.id]);
  const level = Number(ur.rows[0]?.level || 1);
  const difficulty = level >= 19 ? 3 : level >= 9 ? 2 : 1;
  const botName = `BOT • ${getRankName(level)}`;

  // Create bot
  const botId = uuidv4();
  await pool.query(
    "INSERT INTO bots (id,name,difficulty) VALUES ($1,$2,$3)",
    [botId, botName, difficulty]
  );

  // Remove user from room, add bot member
  await pool.query("DELETE FROM room_members WHERE room_id=$1 AND user_id=$2", [
    roomId,
    req.user.id,
  ]);
  await pool.query(
  "INSERT INTO room_members (id, room_id, bot_id) VALUES ($1,$2,$3)",
  [
    uuidv4(),
    roomId,
    botId,
  ]
);

  return res.json({ ok: true, roomId, botId, botName, difficulty });
});

/* ============================= */
/* ========= START ============= */
/* ============================= */

initDb().then(() => {
  app.listen(PORT, () => console.log("API listening on", PORT));
});
