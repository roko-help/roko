/**
 * Roko Telegram Bot — Firebase Cloud Functions (2nd gen)
 * Wraps existing bot/index.js via module.exports
 * Persistence: Firestore instead of JSON files
 */

const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

// Load bot as module
const bot = require('./bot/index.js');

// ─── Firestore persistence ───────────────────────────────
const rokoCol = db.collection('roko');

async function loadData() {
  try {
    const [langDoc, watchDoc, statsDoc] = await Promise.all([
      rokoCol.doc('langs').get(),
      rokoCol.doc('watchlist').get(),
      rokoCol.doc('stats').get(),
    ]);

    bot._overridePersistence({
      userLangs: langDoc.exists ? (langDoc.data().data || {}) : {},
      watchlist: watchDoc.exists ? (watchDoc.data().data || {}) : {},
      stats: statsDoc.exists ? (statsDoc.data().data || { checks: {}, daily: {}, totalChecks: 0 }) : { checks: {}, daily: {}, totalChecks: 0 },
      saveLangs: () => rokoCol.doc('langs').set({ data: bot.userLangs }).catch(e => console.error('saveLangs:', e.message)),
      saveWatchlist: () => rokoCol.doc('watchlist').set({ data: bot.watchlist }).catch(e => console.error('saveWatchlist:', e.message)),
      saveStats: () => rokoCol.doc('stats').set({ data: bot.stats }).catch(e => console.error('saveStats:', e.message)),
    });
  } catch (e) {
    console.error('loadData failed:', e.message);
    // Override persistence with no-op saves so bot still works (stateless)
    bot._overridePersistence({
      userLangs: {},
      watchlist: {},
      stats: { checks: {}, daily: {}, totalChecks: 0 },
      saveLangs: () => {},
      saveWatchlist: () => {},
      saveStats: () => {},
    });
  }
}

// ─── Webhook ──────────────────────────────────────────────
exports.webhook = onRequest({ region: 'europe-west1', timeoutSeconds: 120, invoker: 'public' }, async (req, res) => {
  const secret = process.env.WEBHOOK_SECRET || '';
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    return res.status(403).send('Forbidden');
  }

  await loadData();
  const update = req.body;

  try {
    if (update.message) await bot.handleMessage(update.message);
    if (update.callback_query) await bot.handleCallback(update.callback_query);
  } catch (e) {
    console.error('Webhook error:', e.message);
  }

  res.sendStatus(200);
});

// ─── Watchlist monitor: every 30 min ──────────────────────
exports.monitor = onSchedule({ schedule: 'every 30 minutes', region: 'europe-west1', timeoutSeconds: 300 }, async () => {
  await loadData();
  await bot.monitorLoop();
});

// ─── Weekly digest: Monday 10:00 UTC ──────────────────────
exports.digest = onSchedule({ schedule: '0 10 * * 1', timeZone: 'UTC', region: 'europe-west1', timeoutSeconds: 60 }, async () => {
  await loadData();
  await bot.postDigest();
});
