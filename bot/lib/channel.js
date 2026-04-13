// Channel posting – scam alerts, trending alerts, weekly digest
const { send, esc } = require('./telegram');
const { CHANNEL_ID } = require('./config');
const statsModule = require('./stats');

function postToChannel(text) {
  return send(CHANNEL_ID, text);
}

async function alertScam(target, score, checksText, userId) {
  const stats = statsModule.stats;
  const key = target.toLowerCase();
  const c = stats.checks[key] || {};
  const userCount = (c.users || []).length;
  const checkCount = c.count || 1;

  const today = new Date().toISOString().slice(0, 10);
  const alertKey = `_alerted_${key}_${today}`;
  if (stats[alertKey]) return;
  stats[alertKey] = true;
  statsModule.persistStats();

  const short = target.length > 40 ? target.slice(0, 15) + '...' + target.slice(-8) : target;
  await postToChannel(
    `🚨 <b>Scam alert</b>\n\n` +
    `<code>${esc(short)}</code>\n` +
    `Score: <b>${score}/100</b>\n\n` +
    `${checksText}\n\n` +
    (checkCount > 1 ? `📊 Checked ${checkCount} times by ${userCount} user${userCount > 1 ? 's' : ''}\n\n` : '') +
    `🦝 Check anything: @RokoHelpBot\n` +
    `🌐 roko.help`
  );
}

async function alertTrending(target) {
  const stats = statsModule.stats;
  const key = target.toLowerCase();
  const c = stats.checks[key];
  if (!c) return;

  const recentWindow = 2 * 60 * 60 * 1000;
  if (c.count < 5 || (c.users || []).length < 3) return;
  if (Date.now() - c.firstTs > recentWindow) return;

  const today = new Date().toISOString().slice(0, 10);
  const trendKey = `_trending_${key}_${today}`;
  if (stats[trendKey]) return;
  stats[trendKey] = true;
  statsModule.persistStats();

  const short = target.length > 40 ? target.slice(0, 15) + '...' + target.slice(-8) : target;
  await postToChannel(
    `🔥 <b>Trending</b>\n\n` +
    `<code>${esc(short)}</code>\n` +
    `${c.count} checks from ${(c.users || []).length} users in the last hour.\n` +
    `Score: <b>${c.lastScore}/100</b>\n\n` +
    `Something's going on. Check it yourself:\n` +
    `🦝 @RokoHelpBot`
  );
}

async function postDigest() {
  const stats = statsModule.stats;
  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400000);
  let total = 0, scams = 0;
  const targetCounts = {};

  for (const [date, day] of Object.entries(stats.daily)) {
    if (new Date(date) < weekAgo) continue;
    total += day.total;
    scams += day.scams;
    for (const [t, cnt] of Object.entries(day.targets || {})) {
      targetCounts[t] = (targetCounts[t] || 0) + cnt;
    }
  }

  if (total === 0) return;

  const topChecked = Object.entries(targetCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t, n]) => {
      const short = t.length > 30 ? t.slice(0, 12) + '...' + t.slice(-6) : t;
      return `  <code>${esc(short)}</code> – ${n}x`;
    }).join('\n');

  await postToChannel(
    `📊 <b>Week in numbers</b>\n\n` +
    `Checks: <b>${total}</b>\n` +
    `Scams caught: <b>${scams}</b>\n\n` +
    (topChecked ? `Top checked:\n${topChecked}\n\n` : '') +
    `🦝 @RokoHelpBot · roko.help`
  );
}

module.exports = { postToChannel, alertScam, alertTrending, postDigest };
