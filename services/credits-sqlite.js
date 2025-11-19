const { db } = require('../db/sqlite');

function getUserKeyFromHeaders(req) {
  return (
    req.headers['x-telegram-user-id'] ||
    req.headers['x-user-id'] ||
    req.headers['x-user-email'] ||
    ''
  );
}

function ensureUser(userKey, opts = {}) {
  const key = String(userKey);
  const existing = db.prepare('SELECT user_key FROM users WHERE user_key = ?').get(key);
  if (!existing) {
    db.prepare('INSERT INTO users (user_key, email, telegram_id, balance) VALUES (?, ?, ?, ?)').run(
      key,
      opts.email || null,
      opts.telegram_id || null,
      0
    );
  }
}

function getCredits(userKey) {
  const row = db.prepare('SELECT balance FROM users WHERE user_key = ?').get(String(userKey));
  return row ? Number(row.balance) : 0;
}

function addCredits(userKey, amount, reason = 'manual_add') {
  const key = String(userKey);
  ensureUser(key);
  const amt = Number(amount);
  db.prepare('UPDATE users SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_key = ?').run(amt, key);
  db.prepare('INSERT INTO credits_transactions (user_key, change, reason) VALUES (?, ?, ?)').run(key, amt, reason);
}

function deductCredits(userKey, amount, reason = 'deduct_for_generation') {
  const key = String(userKey);
  ensureUser(key);
  const amt = Number(amount);
  const current = getCredits(key);
  if (current < amt) return false;
  db.prepare('UPDATE users SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE user_key = ?').run(amt, key);
  db.prepare('INSERT INTO credits_transactions (user_key, change, reason) VALUES (?, ?, ?)').run(key, -amt, reason);
  return true;
}

module.exports = {
  getUserKeyFromHeaders,
  getCredits,
  addCredits,
  deductCredits
};