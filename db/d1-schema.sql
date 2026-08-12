-- Koka — Cloudflare D1 schema
-- Apply with:
--   npx wrangler d1 execute koka --remote --file docs/d1-schema.sql
--
-- This matches exactly what the app creates at runtime
-- (src/server/repo.server.ts). Everything the app stores — accounts,
-- settings (with the Gemini key encrypted), the anime/manga library with
-- decimal scores, dates and rewatches, notes, and the import log — lives here.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,       -- PBKDF2-SHA256, 100k iterations
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  user_id      TEXT PRIMARY KEY,
  gemini_key   TEXT,                 -- AES-GCM ciphertext ("enc:" prefix)
  model        TEXT,
  anilist_user TEXT,
  spoiler_free INTEGER NOT NULL DEFAULT 1,
  theme        TEXT NOT NULL DEFAULT 'dark',
  light_theme  TEXT NOT NULL DEFAULT 'paper',
  dark_theme   TEXT NOT NULL DEFAULT 'koka',
  media_mode   TEXT NOT NULL DEFAULT 'ANIME',
  updated_at   INTEGER
);

CREATE TABLE IF NOT EXISTS library_entries (
  user_id      TEXT    NOT NULL,
  media_type   TEXT    NOT NULL,     -- ANIME | MANGA
  media_id     INTEGER NOT NULL,     -- AniList id
  status       TEXT    NOT NULL,     -- CURRENT | PLANNING | COMPLETED | PAUSED | DROPPED | REPEATING
  progress     INTEGER NOT NULL DEFAULT 0,
  score        REAL,                 -- decimals supported (8.5)
  favorite     INTEGER NOT NULL DEFAULT 0,
  started_at   TEXT,
  completed_at TEXT,
  repeat_count INTEGER,
  tags        TEXT    NOT NULL DEFAULT '[]',   -- JSON array
  custom_lists TEXT   NOT NULL DEFAULT '[]',   -- JSON array
  media       TEXT    NOT NULL,     -- JSON snapshot of the AniList media
  updated_at   INTEGER NOT NULL,
  added_at     INTEGER NOT NULL,
  PRIMARY KEY (user_id, media_type, media_id)
);

CREATE INDEX IF NOT EXISTS idx_library_status
  ON library_entries (user_id, media_type, status);
CREATE INDEX IF NOT EXISTS idx_library_updated
  ON library_entries (user_id, media_type, updated_at DESC);

CREATE TABLE IF NOT EXISTS notes (
  user_id    TEXT    NOT NULL,
  media_type TEXT    NOT NULL,
  media_id   INTEGER NOT NULL,
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL DEFAULT '',
  tags       TEXT    NOT NULL DEFAULT '[]',   -- JSON array
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, media_type, media_id)
);

CREATE INDEX IF NOT EXISTS idx_notes_updated
  ON notes (user_id, media_type, updated_at DESC);

CREATE TABLE IF NOT EXISTS import_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,
  source     TEXT NOT NULL,
  mode       TEXT NOT NULL,   -- merge | replace
  count      INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
