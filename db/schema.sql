-- Watchlist dashboard (Cloudflare D1). Apply with: wrangler d1 execute watchlist --remote --file db/schema.sql
CREATE TABLE IF NOT EXISTS watchlist (
  symbol      TEXT PRIMARY KEY,
  name        TEXT,
  exchange    TEXT,
  notes       TEXT DEFAULT '',
  target      REAL,
  added_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- one briefing per symbol per trading day; json holds calculated / sourced / interpretation sections
CREATE TABLE IF NOT EXISTS briefings (
  symbol      TEXT NOT NULL,
  trade_date  TEXT NOT NULL,
  json        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (symbol, trade_date)
);

-- short-lived cache for market-data responses (saves free-tier API credits)
CREATE TABLE IF NOT EXISTS cache (
  key         TEXT PRIMARY KEY,
  json        TEXT NOT NULL,
  expires     INTEGER NOT NULL
);

-- failed login attempts, for basic rate limiting
CREATE TABLE IF NOT EXISTS login_attempts (
  ip          TEXT NOT NULL,
  at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS login_attempts_ip ON login_attempts (ip, at);

-- daily high-volume scanner results (one row per session)
CREATE TABLE IF NOT EXISTS scans (
  trade_date  TEXT PRIMARY KEY,
  json        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
