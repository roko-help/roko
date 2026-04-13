// Stats tracking and persistence
const { readFileSync, existsSync } = require('fs');
const fsPromises = require('fs').promises;
const { resolve } = require('path');

const STATS_PATH = resolve(__dirname, '..', 'stats.json');
let stats = { checks: {}, daily: {}, totalChecks: 0 };
try { if (existsSync(STATS_PATH)) stats = JSON.parse(readFileSync(STATS_PATH, 'utf8')); } catch {}
let saveStats = () => { fsPromises.writeFile(STATS_PATH, JSON.stringify(stats, null, 2)).catch(() => {}); };

function trackCheck(target, score, label, userId) {
  const key = target.toLowerCase();
  const today = new Date().toISOString().slice(0, 10);

  if (!stats.checks[key]) stats.checks[key] = { count: 0, users: [], firstTs: Date.now() };
  const c = stats.checks[key];
  c.count++;
  c.lastScore = score;
  c.lastLabel = label;
  c.lastTs = Date.now();
  if (userId && !c.users.includes(String(userId))) c.users.push(String(userId));

  if (!stats.daily[today]) stats.daily[today] = { total: 0, scams: 0, targets: {} };
  stats.daily[today].total++;
  if (score < 20) stats.daily[today].scams++;
  stats.daily[today].targets[key] = (stats.daily[today].targets[key] || 0) + 1;

  stats.totalChecks = (stats.totalChecks || 0) + 1;
  saveStats();

  return c;
}

function getStats() { return stats; }

function persistStats() { saveStats(); }

function overrideStats(newStats, newSave) {
  if (newStats) stats = newStats;
  if (newSave) saveStats = newSave;
}

module.exports = { trackCheck, getStats, persistStats, overrideStats, get stats() { return stats; } };
