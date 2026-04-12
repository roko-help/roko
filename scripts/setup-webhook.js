#!/usr/bin/env node
/**
 * Sets up Telegram webhook for Roko Cloud Function
 * Usage: node scripts/setup-webhook.js [--delete]
 */

const { readFileSync } = require('fs');
const { resolve } = require('path');
const https = require('https');

// Read token from LLM/.env
const ENV_PATH = resolve(__dirname, '../../LLM/.env');
let TOKEN;
try {
  const env = readFileSync(ENV_PATH, 'utf8');
  const m = env.match(/^ROKO_TELEGRAM_TOKEN=(.+)$/m);
  if (m) TOKEN = m[1].trim();
} catch {}
if (!TOKEN) { console.error('No ROKO_TELEGRAM_TOKEN in LLM/.env'); process.exit(1); }

const WEBHOOK_URL = 'https://webhook-hppgtfnr5q-ew.a.run.app';
const API = `https://api.telegram.org/bot${TOKEN}`;

function call(method, body = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(`${API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); } catch { resolve(buf); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  if (process.argv.includes('--delete')) {
    const r = await call('deleteWebhook');
    console.log('deleteWebhook:', r.ok ? '✅ Done' : r);
    return;
  }

  if (process.argv.includes('--info')) {
    const r = await call('getWebhookInfo');
    console.log('Webhook info:', JSON.stringify(r.result, null, 2));
    return;
  }

  // Set webhook
  const secret = require('crypto').randomBytes(32).toString('hex');
  const r = await call('setWebhook', {
    url: WEBHOOK_URL,
    secret_token: secret,
    allowed_updates: ['message', 'callback_query'],
    max_connections: 40,
  });
  console.log('setWebhook:', r.ok ? '✅ Done' : r);
  console.log('Webhook URL:', WEBHOOK_URL);
  console.log('');
  console.log('⚠️  Save this secret token – set it in Firebase config:');
  console.log(`   firebase functions:config:set telegram.webhook_secret="${secret}" --project roko-help`);

  // Also set the bot token in firebase config
  console.log('');
  console.log('Also set the bot token:');
  console.log(`   firebase functions:config:set telegram.token="${TOKEN}" --project roko-help`);

  // Verify
  const info = await call('getWebhookInfo');
  console.log('');
  console.log('Verification:', info.result?.url === WEBHOOK_URL ? '✅ Webhook active' : '❌ Check URL');

  // Set bot commands
  await call('setMyCommands', {
    commands: [
      { command: 'start', description: 'Start Roko' },
      { command: 'help', description: 'How to use' },
      { command: 'lang', description: 'Change language' },
      { command: 'watch', description: 'Monitor address/domain' },
      { command: 'watchlist', description: 'Your watchlist' },
      { command: 'unwatch', description: 'Stop monitoring' },
      { command: 'approvals', description: 'Scan token approvals' },
    ],
  });
  console.log('Bot commands: ✅ Set');

  // Set menu button → Mini-app
  await call('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: '🦝 Roko',
      web_app: { url: 'https://roko-help.web.app/app.html' },
    },
  });
  console.log('Menu button: ✅ Set → Mini-app');
})();
