const creditsStore = new Map(); // key: userId/email, value: number

function getUserKeyFromHeaders(req) {
  return (
    req.headers['x-telegram-user-id'] ||
    req.headers['x-user-id'] ||
    req.headers['x-user-email'] ||
    ''
  );
}

function getCredits(userKey) {
  return creditsStore.get(String(userKey)) || 0;
}

function addCredits(userKey, amount) {
  const k = String(userKey);
  creditsStore.set(k, getCredits(k) + Number(amount));
}

function deductCredits(userKey, amount) {
  const k = String(userKey);
  const current = getCredits(k);
  if (current < Number(amount)) return false;
  creditsStore.set(k, current - Number(amount));
  return true;
}

module.exports = {
  creditsStore,
  getUserKeyFromHeaders,
  getCredits,
  addCredits,
  deductCredits
};