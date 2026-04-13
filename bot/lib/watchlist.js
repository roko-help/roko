// Watchlist persistence and monitoring loop
const { readFileSync, existsSync } = require('fs');
const fsPromises = require('fs').promises;
const { resolve } = require('path');
const { send, esc } = require('./telegram');
const { t } = require('./i18n');
const { detectAddressType } = require('./data');
const { checkDNS } = require('./checks/domain');
const { checkAML } = require('./checks/aml');

const WATCHLIST_PATH = resolve(__dirname, '..', 'watchlist.json');
let watchlist = {};
try { if (existsSync(WATCHLIST_PATH)) watchlist = JSON.parse(readFileSync(WATCHLIST_PATH, 'utf8')); } catch {}
let saveWatchlist = () => { fsPromises.writeFile(WATCHLIST_PATH, JSON.stringify(watchlist, null, 2)).catch(() => {}); };

function addToWatchlist(chatId, type, value) {
  if (!watchlist[chatId]) watchlist[chatId] = [];
  if (watchlist[chatId].some(w => w.value === value)) return false;
  if (watchlist[chatId].length >= 10) return 'limit';
  watchlist[chatId].push({ type, value, addedAt: new Date().toISOString() });
  saveWatchlist();
  return true;
}

function removeFromWatchlist(chatId, value) {
  if (!watchlist[chatId]) return false;
  const before = watchlist[chatId].length;
  watchlist[chatId] = watchlist[chatId].filter(w => w.value !== value);
  if (watchlist[chatId].length === before) return false;
  saveWatchlist();
  return true;
}

function getWatchlist(chatId) {
  return watchlist[chatId] || [];
}

async function monitorLoop() {
  for (const [chatId, items] of Object.entries(watchlist)) {
    for (const item of items) {
      try {
        if (item.type === 'domain') {
          const dns = await checkDNS(item.value).catch(() => null);
          if (dns && !dns.resolves && !item.alertedDnsDown) {
            await send(chatId, t('monitor_dns_down', chatId, esc(item.value)));
            item.alertedDnsDown = true;
            saveWatchlist();
          } else if (dns && dns.resolves && item.alertedDnsDown) {
            await send(chatId, t('monitor_dns_up', chatId, esc(item.value)));
            item.alertedDnsDown = false;
            saveWatchlist();
          }
        }

        if (item.type === 'address') {
          const chain = detectAddressType(item.value);
          if (chain === 'eth') {
            const aml = await checkAML(item.value, 'eth').catch(() => null);
            if (aml?.sanctioned && !item.alertedSanctioned) {
              const shortA = esc(item.value.slice(0, 12)) + '...' + esc(item.value.slice(-6));
              await send(chatId, t('monitor_sanctioned', chatId, shortA));
              item.alertedSanctioned = true;
              saveWatchlist();
            }
          }
        }
      } catch {}
    }
  }
}

function overrideWatchlist(newWatchlist, newSave) {
  if (newWatchlist) watchlist = newWatchlist;
  if (newSave) saveWatchlist = newSave;
}

function getWatchlistData() { return watchlist; }

module.exports = {
  addToWatchlist, removeFromWatchlist, getWatchlist,
  monitorLoop, overrideWatchlist, getWatchlistData,
  get watchlist() { return watchlist; },
};
