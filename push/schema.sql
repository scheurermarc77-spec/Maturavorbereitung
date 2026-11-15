CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  subscription_json TEXT NOT NULL,
  started_day TEXT NOT NULL,
  completed_day TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_started ON subscriptions(started_day);
