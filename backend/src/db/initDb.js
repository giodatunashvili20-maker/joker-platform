import { pool } from "../db.js";

export async function initDb() {
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

    
    /* ================= MATCHES ================= */
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      game_type TEXT NOT NULL,
      mode TEXT NOT NULL,
      xishte INT NOT NULL DEFAULT 1,
      delete_scope TEXT NOT NULL DEFAULT 'last',
      tier TEXT NOT NULL,

      player1_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      player2_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      player3_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      player4_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

      status TEXT NOT NULL DEFAULT 'active', -- active | finished | canceled
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_matches_p1 ON matches(player1_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_matches_p2 ON matches(player2_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_matches_p3 ON matches(player3_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_matches_p4 ON matches(player4_id, created_at DESC);
    

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
