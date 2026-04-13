// Bot configuration, token loading, and constants
const { readFileSync } = require('fs');
const { resolve } = require('path');

const ENV_PATH = resolve(__dirname, '../../../LLM/.env');
let TOKEN = process.env.ROKO_TELEGRAM_TOKEN;
if (!TOKEN) {
  try {
    const env = readFileSync(ENV_PATH, 'utf8');
    const m = env.match(/^ROKO_TELEGRAM_TOKEN=(.+)$/m);
    if (m) TOKEN = m[1].trim();
  } catch {}
}
if (!TOKEN) {
  if (require.main === module) { console.error('No ROKO_TELEGRAM_TOKEN'); process.exit(1); }
  else console.warn('⚠️ No ROKO_TELEGRAM_TOKEN – bot commands will fail until token is set');
}

const API = `https://api.telegram.org/bot${TOKEN}`;

// USDT contract addresses
const USDT_ERC20 = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDT_TRC20 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

// Channel
const CHANNEL_ID = '@roko_help';

// Rate limiter settings
const RATE_LIMIT = { maxChecks: 5, windowMs: 60000, maxDaily: 50 };

module.exports = { TOKEN, API, USDT_ERC20, USDT_TRC20, CHANNEL_ID, RATE_LIMIT };
