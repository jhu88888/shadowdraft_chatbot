const Database = require('better-sqlite3');

const db = new Database('shadowdraft.sqlite', { verbose: null });
db.pragma('journal_mode = WAL');

// users: 以 user_key 作为唯一标识（邮箱或 Telegram ID）
// credits_transactions: 积分变更流水
// generations: 之后可存生成记录（可选）
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key TEXT UNIQUE NOT NULL,
  email TEXT,
  telegram_id TEXT,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credits_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key TEXT NOT NULL,
  change INTEGER NOT NULL, -- 正数为增加，负数为扣减
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS generations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key TEXT NOT NULL,
  title TEXT,
  content TEXT,
  word_count INTEGER,
  mode TEXT,
  target_language TEXT,
  adult_mode INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

module.exports = {
  db
};