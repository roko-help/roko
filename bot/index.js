// Roko Telegram Bot – entry point (polling + Cloud Function export)
const { tg } = require('./lib/telegram');
const { handleMessage, handleCallback } = require('./lib/handlers');
const { monitorLoop } = require('./lib/watchlist');
const { postDigest } = require('./lib/channel');
const { overrideLangs, getUserLangs } = require('./lib/i18n');
const { overrideWatchlist, getWatchlistData } = require('./lib/watchlist');
const { overrideStats } = require('./lib/stats');
const statsModule = require('./lib/stats');

// --- Polling ---
let offset = 0;
async function poll() {
  while (true) {
    try {
      const res = await tg('getUpdates', { offset, timeout: 30 });
      if (res.ok && res.result) {
        for (const u of res.result) {
          offset = u.update_id + 1;
          if (u.message) handleMessage(u.message).catch(e => console.error('Handler:', e.message));
          if (u.callback_query) handleCallback(u.callback_query).catch(e => console.error('Callback:', e.message));
        }
      }
    } catch (e) {
      console.error('Poll:', e.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

async function main() {
  await tg('deleteWebhook', {});
  const me = await tg('getMe', {});
  if (!me.ok) { console.error('Failed:', me); process.exit(1); }
  console.log(`🦝 Roko v4 bot started: @${me.result.username}`);
  console.log(`   Chains: BTC, ETH (+ USDT ERC-20), TRON (+ USDT TRC-20)`);
  console.log(`   Checks: DNS, RDAP, SSL, sanctions, site scan, TG OSINT`);
  console.log(`   AML: OFAC SDN screening`);
  console.log(`   Features: approval scanning, watchlist monitoring`);
  console.log(`   Channel: @roko_help (scam alerts, digest)`);

  // Weekly digest – every Monday at 10:00 UTC
  function scheduleDigest() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCDate(now.getUTCDate() + ((8 - now.getUTCDay()) % 7 || 7));
    next.setUTCHours(10, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 7);
    const ms = next - now;
    console.log(`   Next digest: ${next.toISOString()} (in ${Math.round(ms / 3600000)}h)`);
    setTimeout(() => { postDigest().catch(e => console.error('Digest:', e.message)); scheduleDigest(); }, ms);
  }
  scheduleDigest();

  // Run monitoring every 30 minutes
  setInterval(monitorLoop, 30 * 60 * 1000);

  poll();
}

// --- Module mode vs standalone ---
if (require.main === module) {
  main();
} else {
  module.exports = {
    handleMessage, handleCallback, monitorLoop, postDigest,
    _overridePersistence(overrides) {
      if (overrides.userLangs !== undefined) overrideLangs(overrides.userLangs, overrides.saveLangs);
      if (overrides.watchlist !== undefined) overrideWatchlist(overrides.watchlist, overrides.saveWatchlist);
      if (overrides.stats !== undefined) overrideStats(overrides.stats, overrides.saveStats);
    },
    get userLangs() { return getUserLangs(); },
    get watchlist() { return getWatchlistData(); },
    get stats() { return statsModule.stats; },
  };
}
