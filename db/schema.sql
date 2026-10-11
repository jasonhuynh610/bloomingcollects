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

-- trade ideas: one row per idea, kept forever for honest outcome review
CREATE TABLE IF NOT EXISTS ideas (
  id          TEXT PRIMARY KEY,
  trade_date  TEXT NOT NULL,
  symbol      TEXT NOT NULL,
  side        TEXT NOT NULL,
  status      TEXT NOT NULL,
  json        TEXT NOT NULL,
  outcome     TEXT,
  outcome_status TEXT NOT NULL DEFAULT 'open',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ideas_date ON ideas (trade_date);
CREATE INDEX IF NOT EXISTS ideas_open ON ideas (outcome_status);

-- one market overview per trading day (regime, sectors, macro news, AI summary)
CREATE TABLE IF NOT EXISTS idea_runs (
  trade_date  TEXT PRIMARY KEY,
  json        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- intraday alerts
CREATE TABLE IF NOT EXISTS alerts (
  id          TEXT PRIMARY KEY,
  ts          INTEGER NOT NULL,
  symbol      TEXT NOT NULL,
  kind        TEXT NOT NULL,
  json        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS alerts_ts ON alerts (ts);