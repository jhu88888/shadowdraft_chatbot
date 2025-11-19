module.exports = {
  USE_TELEGRAM_STARS: process.env.USE_TELEGRAM_STARS === 'true',
  PAYMENT_PROVIDER_TOKEN: process.env.PAYMENT_PROVIDER_TOKEN || '',
  CREDIT_PACK_STARS: Number(process.env.CREDIT_PACK_STARS || 100),
  CREDIT_PACK_AMOUNT: Number(process.env.CREDIT_PACK_AMOUNT || 100),
  COST_PER_STORY: Number(process.env.COST_PER_STORY || 5),
};