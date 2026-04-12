/**
 * Roko Telegram Bot v4 — Crypto Exchange Trust Index
 * Checks: DNS, WHOIS/RDAP, SSL, sanctions DB, site content scan,
 *         brand mismatch, Telegram OSINT, blockchain address analysis,
 *         AML/sanctions screening, wallet approval scanning, monitoring
 *
 * Supported chains: BTC, ETH (+ ERC-20 USDT), TRON (+ TRC-20 USDT)
 */

const https = require('https');
const http = require('http');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { execSync, execFileSync } = require('child_process');
const fsPromises = require('fs').promises;
const { resolve } = require('path');

// --- Config ---
const ENV_PATH = resolve(__dirname, '../../LLM/.env');
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
  else console.warn('⚠️ No ROKO_TELEGRAM_TOKEN — bot commands will fail until token is set');
}

const API = `https://api.telegram.org/bot${TOKEN}`;

// USDT contract addresses
const USDT_ERC20 = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDT_TRC20 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

// --- Channel ---
const CHANNEL_ID = '@roko_help';

// --- i18n ---
const LANG_PATH = resolve(__dirname, 'langs.json');
let userLangs = {}; // { chatId: 'en'|'ru'|'es' }
try { if (existsSync(LANG_PATH)) userLangs = JSON.parse(readFileSync(LANG_PATH, 'utf8')); } catch {}
let saveLangs = () => { fsPromises.writeFile(LANG_PATH, JSON.stringify(userLangs)).catch(() => {}); };
function getLang(chatId) { return userLangs[String(chatId)] || 'en'; }
function setLang(chatId, lang) { userLangs[String(chatId)] = lang; saveLangs(); }

const I = {
  start: {
    en: `🦝 <b>Roko</b> — I check exchangers in seconds\n\nSend me anything:\n• Website → <code>bestchange.com</code>\n• Telegram → <code>@crypto_dealer</code>\n• Wallet → BTC, ETH or TRON address\n\nI'll check the domain, sanctions, blockchain, approvals — and tell you if it's safe.\n\nTry: <code>garantex.org</code>`,
    ru: `🦝 <b>Roko</b> — проверяю обменники за секунды\n\nСкинь мне что угодно:\n• Сайт → <code>bestchange.com</code>\n• Телеграм → <code>@crypto_dealer</code>\n• Кошелёк → BTC, ETH или TRON адрес\n\nЯ проверю домен, санкции, блокчейн, approvals — и скажу, стоит ли доверять.\n\nПопробуй: <code>garantex.org</code>`,
    es: `🦝 <b>Roko</b> — verifico exchangers en segundos\n\nEnvíame lo que sea:\n• Sitio → <code>bestchange.com</code>\n• Telegram → <code>@crypto_dealer</code>\n• Wallet → dirección BTC, ETH o TRON\n\nVerificaré dominio, sanciones, blockchain, approvals — y te diré si es seguro.\n\nPrueba: <code>garantex.org</code>`,
  },
  help: {
    en: `🦝 <b>Roko</b> — just send a link, @handle, or wallet address.\n\n<b>What I check:</b>\n🌐 Website — domain, age, SSL, content\n💬 Telegram — profile, suspicious patterns\n⛓ Wallet — balance, history, USDT\n🛡️ Sanctions — OFAC, mixers, scam databases\n🔓 Approvals — who can spend your tokens\n\n<b>More:</b>\n/watch <code>address</code> — 24/7 monitoring\n/watchlist — your list\n/approvals <code>0x... or T...</code> — scan approvals\n/lang — change language\n\nHelp: @roko_help · roko.help`,
    ru: `🦝 <b>Roko</b> — просто скинь ссылку, @хендл или адрес кошелька.\n\n<b>Что проверяю:</b>\n🌐 Сайт — домен, возраст, SSL, контент\n💬 Телеграм — профиль, подозрительные паттерны\n⛓ Кошелёк — баланс, история, USDT\n🛡️ Санкции — OFAC, миксеры, скам-базы\n🔓 Approvals — кто может тратить твои токены\n\n<b>Ещё:</b>\n/watch <code>адрес</code> — мониторинг 24/7\n/watchlist — твой список\n/approvals <code>0x... или T...</code> — скан approvals\n/lang — сменить язык\n\nПомощь: @roko_help · roko.help`,
    es: `🦝 <b>Roko</b> — envía un link, @usuario o dirección de wallet.\n\n<b>Qué verifico:</b>\n🌐 Sitio — dominio, antigüedad, SSL, contenido\n💬 Telegram — perfil, patrones sospechosos\n⛓ Wallet — balance, historial, USDT\n🛡️ Sanciones — OFAC, mixers, bases de scam\n🔓 Approvals — quién puede gastar tus tokens\n\n<b>Más:</b>\n/watch <code>dirección</code> — monitoreo 24/7\n/watchlist — tu lista\n/approvals <code>0x... o T...</code> — escanear approvals\n/lang — cambiar idioma\n\nAyuda: @roko_help · roko.help`,
  },
  checking_addr: { en: '🔍 Checking %s address...', ru: '🔍 Проверяю %s адрес...', es: '🔍 Verificando dirección %s...' },
  checking_domain: { en: '🔍 Checking <b>%s</b>...', ru: '🔍 Проверяю <b>%s</b>...', es: '🔍 Verificando <b>%s</b>...' },
  checking_handle: { en: '🔍 Checking <b>@%s</b>...', ru: '🔍 Проверяю <b>@%s</b>...', es: '🔍 Verificando <b>@%s</b>...' },
  trust: { en: 'Trust', ru: 'Доверие', es: 'Confianza' },
  watch_cmd: { en: '📡 /watch <code>%s</code> — monitor', ru: '📡 /watch <code>%s</code> — следить', es: '📡 /watch <code>%s</code> — monitorear' },
  score_hi: { en: 'Low risk', ru: 'Низкий риск', es: 'Riesgo bajo' },
  score_mid: { en: 'Medium risk', ru: 'Средний риск', es: 'Riesgo medio' },
  score_lo: { en: 'High risk', ru: 'Высокий риск', es: 'Riesgo alto' },
  score_tg_hi: { en: 'Looks OK', ru: 'Похоже на норм', es: 'Parece OK' },
  score_tg_mid: { en: 'Be careful', ru: 'Осторожно', es: 'Con cuidado' },
  score_tg_lo: { en: 'High risk', ru: 'Высокий риск', es: 'Riesgo alto' },
  addr_fail: { en: `🦝 Can't determine address type.`, ru: `🦝 Не удалось определить тип адреса.`, es: `🦝 No puedo determinar el tipo de dirección.` },
  error: { en: 'Error: %s. Try again.', ru: 'Ошибка: %s. Попробуй ещё раз.', es: 'Error: %s. Inténtalo de nuevo.' },
  watch_use: { en: 'Use: /watch <code>address or domain</code>', ru: 'Используй: /watch <code>адрес или домен</code>', es: 'Usa: /watch <code>dirección o dominio</code>' },
  watch_unrecognized: { en: `🦝 Can't recognize — send a wallet address or domain.`, ru: `🦝 Не могу распознать — отправь адрес кошелька или домен.`, es: `🦝 No reconozco — envía una dirección o dominio.` },
  watch_added: { en: `📡 <b>Watching:</b> <code>%s</code>\nChecking every 30 min. I'll alert you if anything changes.\nRemove: /unwatch <code>%s</code>`, ru: `📡 <b>Слежу:</b> <code>%s</code>\nПроверяю каждые 30 мин. Напишу, если что-то изменится.\nУбрать: /unwatch <code>%s</code>`, es: `📡 <b>Vigilando:</b> <code>%s</code>\nVerificando cada 30 min. Te avisaré si algo cambia.\nQuitar: /unwatch <code>%s</code>` },
  watch_exists: { en: 'Already in your list.', ru: 'Уже в списке.', es: 'Ya está en tu lista.' },
  watch_limit: { en: 'Limit is 10. Remove something first: /unwatch', ru: 'Лимит — 10. Сначала удали что-нибудь: /unwatch', es: 'Límite: 10. Primero quita algo: /unwatch' },
  unwatch_ok: { en: '✅ Removed %s', ru: '✅ Убрал %s', es: '✅ Quitado %s' },
  unwatch_fail: { en: 'Not in your list.', ru: 'Этого нет в твоём списке.', es: 'No está en tu lista.' },
  watchlist_empty: { en: '📡 Empty list. Add: /watch <code>address or domain</code>', ru: '📡 Список пуст. Добавь: /watch <code>адрес или домен</code>', es: '📡 Lista vacía. Agrega: /watch <code>dirección o dominio</code>' },
  watchlist_title: { en: '📡 <b>Monitoring</b> (%s/10)', ru: '📡 <b>Мониторинг</b> (%s/10)', es: '📡 <b>Monitoreo</b> (%s/10)' },
  watchlist_remove: { en: 'Remove: /unwatch <code>...</code>', ru: 'Удалить: /unwatch <code>...</code>', es: 'Quitar: /unwatch <code>...</code>' },
  approvals_only: { en: '🦝 Approvals — ETH and TRON only.\nSend: /approvals <code>0x... or T...</code>', ru: '🦝 Approvals — только ETH и TRON.\nОтправь: /approvals <code>0x... или T...</code>', es: '🦝 Approvals — solo ETH y TRON.\nEnvía: /approvals <code>0x... o T...</code>' },
  approvals_scanning: { en: '🔍 Scanning approvals...', ru: '🔍 Сканирую approvals...', es: '🔍 Escaneando approvals...' },
  fallback: { en: `🦝 Send me:\n• Website — <code>exchanger.com</code>\n• Telegram — <code>@dealer</code>\n• Wallet — BTC / ETH / TRON\n\n/help — all commands`, ru: `🦝 Скинь мне:\n• Сайт — <code>exchanger.com</code>\n• Телеграм — <code>@dealer</code>\n• Кошелёк — BTC / ETH / TRON\n\n/help — все команды`, es: `🦝 Envíame:\n• Sitio — <code>exchanger.com</code>\n• Telegram — <code>@dealer</code>\n• Wallet — BTC / ETH / TRON\n\n/help — todos los comandos` },
  lang_set: { en: '🌐 Language set to English', ru: '🌐 Язык: Русский', es: '🌐 Idioma: Español' },
  lang_choose: { en: 'Choose language:', ru: 'Выбери язык:', es: 'Elige idioma:' },
  guide_offline_bad: { en: '⛔ Better not meet this person', ru: '⛔ Лучше не встречайся с этим человеком', es: '⛔ Mejor no te reúnas con esta persona' },
  guide_offline: {
    en: ['📍 Public places with cameras only', '💵 Start with a small amount', '📱 Share your location with someone'],
    ru: ['📍 Только публичные места с камерами', '💵 Начни с маленькой суммы', '📱 Скинь геолокацию кому-то из своих'],
    es: ['📍 Solo lugares públicos con cámaras', '💵 Empieza con poco', '📱 Comparte tu ubicación con alguien'],
  },
  guide_wallet: { en: '🔓 Revoke unknown approvals → revoke.cash', ru: '🔓 Отзови незнакомые approvals → revoke.cash', es: '🔓 Revoca approvals desconocidos → revoke.cash' },
  guide_wallet_bad: { en: '⛔ This address has AML issues — don\'t send', ru: '⛔ У этого адреса проблемы с AML — не отправляй', es: '⛔ Esta dirección tiene problemas AML — no envíes' },
  guide_hi: { en: '✅ Looks OK. Split amounts >$1K into 2 transfers', ru: '✅ Выглядит ок. Суммы >$1K лучше разбить на 2 перевода', es: '✅ Parece OK. Divide montos >$1K en 2 envíos' },
  guide_mid: { en: ['⚠️ Send minimum first — wait for payout', '📸 Screenshot the conversation before sending'], ru: ['⚠️ Сначала отправь минимум — дождись выплаты', '📸 Сохрани скрины переписки до перевода'], es: ['⚠️ Envía el mínimo primero — espera el pago', '📸 Captura la conversación antes de enviar'] },
  guide_lo: { en: ['⛔ Roko does not recommend this exchanger', '📢 Have proof of scam? → @roko_help'], ru: ['⛔ Roko не рекомендует этот обменник', '📢 Есть доказательства скама? → @roko_help'], es: ['⛔ Roko no recomienda este exchanger', '📢 ¿Tienes pruebas de estafa? → @roko_help'] },
  monitor_dns_down: { en: '🚨 <b>%s</b> — site is down!\nPossibly shut down or seized. Don\'t send money.', ru: '🚨 <b>%s</b> — сайт не отвечает!\nВозможно, закрыт или изъят. Не отправляй деньги.', es: '🚨 <b>%s</b> — ¡sitio caído!\nPosiblemente cerrado o incautado. No envíes dinero.' },
  monitor_dns_up: { en: '🟢 <b>%s</b> — site is back online.', ru: '🟢 <b>%s</b> — сайт снова онлайн.', es: '🟢 <b>%s</b> — el sitio volvió.' },
  monitor_sanctioned: { en: '🚨 <b>Sanctioned!</b> Address <code>%s</code> is now on a sanctions list.\nDo not send funds.', ru: '🚨 <b>Санкции!</b> Адрес <code>%s</code> попал в санкционный список.\nНе отправляй на него средства.', es: '🚨 <b>¡Sancionado!</b> Dirección <code>%s</code> está en lista de sanciones.\nNo envíes fondos.' },
  roko_hi: { en: '🦝 Looks clean. I dug through everything — no red flags.', ru: '🦝 Чисто. Я всё перерыл — ничего подозрительного.', es: '🦝 Limpio. Busqué por todos lados — sin banderas rojas.' },
  roko_mid: { en: '🦝 Hmm, something smells off. Be careful with this one.', ru: '🦝 Хм, что-то пахнет не так. С этим аккуратнее.', es: '🦝 Hmm, algo huele raro. Ten cuidado con este.' },
  roko_lo: { en: '🦝 Nope. This stinks. I wouldn\'t touch it.', ru: '🦝 Не-а. Воняет. Я бы не связывался.', es: '🦝 No. Esto apesta. Yo no lo tocaría.' },
  roko_sanc: { en: '🦝 BLOCKED. This is on government blacklists. Run.', ru: '🦝 ЗАБЛОКИРОВАНО. В чёрных списках. Беги.', es: '🦝 BLOQUEADO. Está en listas negras del gobierno. Huye.' },
  share_btn: { en: '📢 Share result', ru: '📢 Поделиться', es: '📢 Compartir' },
  web_btn: { en: '🌐 Check on web', ru: '🌐 Проверить на сайте', es: '🌐 Verificar en web' },
};

function t(key, chatId, ...args) {
  const lang = getLang(chatId);
  let val = I[key]?.[lang] || I[key]?.en || '';
  if (Array.isArray(val)) return val;
  for (const a of args) val = val.replace('%s', a);
  return val;
}

// --- Watchlist persistence ---
const WATCHLIST_PATH = resolve(__dirname, 'watchlist.json');
let watchlist = {}; // { chatId: [{ type, value, addedAt }] }
try { if (existsSync(WATCHLIST_PATH)) watchlist = JSON.parse(readFileSync(WATCHLIST_PATH, 'utf8')); } catch {}
let saveWatchlist = () => { fsPromises.writeFile(WATCHLIST_PATH, JSON.stringify(watchlist, null, 2)).catch(() => {}); };

// --- Check stats persistence ---
const STATS_PATH = resolve(__dirname, 'stats.json');
let stats = { checks: {}, daily: {}, totalChecks: 0 };
// stats.checks[target] = { count, lastScore, lastLabel, lastTs, users: Set→Array }
// stats.daily[YYYY-MM-DD] = { total, scams, targets: {} }
try { if (existsSync(STATS_PATH)) stats = JSON.parse(readFileSync(STATS_PATH, 'utf8')); } catch {}
let saveStats = () => { fsPromises.writeFile(STATS_PATH, JSON.stringify(stats, null, 2)).catch(() => {}); };

function trackCheck(target, score, label, userId) {
  const key = target.toLowerCase();
  const today = new Date().toISOString().slice(0, 10);

  // Per-target stats
  if (!stats.checks[key]) stats.checks[key] = { count: 0, users: [], firstTs: Date.now() };
  const c = stats.checks[key];
  c.count++;
  c.lastScore = score;
  c.lastLabel = label;
  c.lastTs = Date.now();
  if (userId && !c.users.includes(String(userId))) c.users.push(String(userId));

  // Daily stats
  if (!stats.daily[today]) stats.daily[today] = { total: 0, scams: 0, targets: {} };
  stats.daily[today].total++;
  if (score < 20) stats.daily[today].scams++;
  stats.daily[today].targets[key] = (stats.daily[today].targets[key] || 0) + 1;

  stats.totalChecks = (stats.totalChecks || 0) + 1;
  saveStats();

  return c;
}

// --- Channel posting ---
function postToChannel(text) {
  return send(CHANNEL_ID, text);
}

async function alertScam(target, score, checksText, userId) {
  const key = target.toLowerCase();
  const c = stats.checks[key] || {};
  const userCount = (c.users || []).length;
  const checkCount = c.count || 1;

  // Don't spam: alert once per target per day
  const today = new Date().toISOString().slice(0, 10);
  const alertKey = `_alerted_${key}_${today}`;
  if (stats[alertKey]) return;
  stats[alertKey] = true;
  saveStats();

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
  const key = target.toLowerCase();
  const c = stats.checks[key];
  if (!c) return;

  // Alert if 5+ checks in last 2 hours from 3+ users
  const recentWindow = 2 * 60 * 60 * 1000;
  if (c.count < 5 || (c.users || []).length < 3) return;
  if (Date.now() - c.firstTs > recentWindow) return;

  const today = new Date().toISOString().slice(0, 10);
  const trendKey = `_trending_${key}_${today}`;
  if (stats[trendKey]) return;
  stats[trendKey] = true;
  saveStats();

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

// --- Weekly digest (runs on timer) ---
async function postDigest() {
  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400000);
  let total = 0, scams = 0;
  const targetCounts = {};
  const scamTargets = [];

  for (const [date, day] of Object.entries(stats.daily)) {
    if (new Date(date) < weekAgo) continue;
    total += day.total;
    scams += day.scams;
    for (const [t, cnt] of Object.entries(day.targets || {})) {
      targetCounts[t] = (targetCounts[t] || 0) + cnt;
    }
  }

  if (total === 0) return; // nothing to report

  const topChecked = Object.entries(targetCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t, n]) => {
      const short = t.length > 30 ? t.slice(0, 12) + '...' + t.slice(-6) : t;
      return `  <code>${esc(short)}</code> — ${n}x`;
    }).join('\n');

  await postToChannel(
    `📊 <b>Week in numbers</b>\n\n` +
    `Checks: <b>${total}</b>\n` +
    `Scams caught: <b>${scams}</b>\n\n` +
    (topChecked ? `Top checked:\n${topChecked}\n\n` : '') +
    `🦝 @RokoHelpBot · roko.help`
  );
}

// --- Telegram helpers ---
function tg(method, body) {
  return new Promise((res, rej) => {
    const data = JSON.stringify(body);
    const req = https.request(`${API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch { res({ ok: false }); } }); });
    req.on('error', rej);
    req.write(data);
    req.end();
  });
}

function send(chatId, text, opts = {}) {
  return tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...opts });
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// --- Known databases ---
// --- Load data from JSON files ---
const DATA_DIR = resolve(__dirname, '..', 'data');

function loadJSON(file) {
  try { return JSON.parse(readFileSync(resolve(DATA_DIR, file), 'utf8')); }
  catch { return null; }
}

const scamDomainsData = loadJSON('scam-domains.json') || [];
const safeDomainsData = loadJSON('safe-domains.json') || [];
const warnDomainsData = loadJSON('warn-domains.json') || [];
const phishingTargetsData = loadJSON('phishing-targets.json');
const ofacData = loadJSON('ofac-addresses.json');

// Build lookup objects from data files
const KNOWN_SCAM = {};
for (const d of scamDomainsData) KNOWN_SCAM[d.domain] = d.reason;

const KNOWN_GOOD = {};
for (const d of safeDomainsData) KNOWN_GOOD[d.domain] = { note: d.note, boost: d.boost };

const KNOWN_WARN = {};
for (const d of warnDomainsData) KNOWN_WARN[d.domain] = d.reason;

const PHISHING_TARGETS = (phishingTargetsData?.targets || []).map(d => d.replace(/\.[^.]+$/, '').toLowerCase());

// OFAC sanctioned crypto addresses — loaded from auto-updated JSON
const SANCTIONED_ADDRESSES = new Set([
  // From auto-updated OFAC SDN list
  ...(ofacData?.addresses || []).map(a => a.toLowerCase()),
  // Hardcoded fallback (in case JSON is missing)
  '0x8589427373d6d84e98730d7795d8f6f8731fda16',
  '0x722122df12d4e14e13ac3b6895a86e84145b6967',
  '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b',
  '0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3',
  '0x910cbd523d972eb0a6f4cae4618ad62622b39dbf',
  '0xa160cdab225685da1d56aa342ad8841c3b53f291',
  '0x6f1ca141a28907f78ebaa64fb83a9088b02a8352',
  '0xb541fc07bc7619fd4062a54d96268525cbc6ffef',
  'bc1q5w5cqx73m6kyf7g99tqjjcswtfnme4wc57w0yc',
  '12hqdsicffsbaydjbhne22sfjtezsqhh',
  '15wdax6n1n5rqepnmrhje8ksfntjgvsrkf',
  'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h',
]);

// --- Phishing detection (Levenshtein distance) ---
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1)
      );
    }
  }
  return matrix[b.length][a.length];
}

function checkPhishing(domain) {
  const dl = domain.toLowerCase().replace(/\.[^.]+$/, ''); // strip TLD
  const results = [];

  for (const target of PHISHING_TARGETS) {
    if (dl === target) continue; // exact match = it IS the brand, not phishing

    // 1. Levenshtein distance ≤ 2 (typosquatting: binnance, coinbsae)
    const dist = levenshtein(dl, target);
    if (dist > 0 && dist <= 2) {
      results.push({ target: target, type: 'typosquat', distance: dist });
      continue;
    }

    // 2. Brand as substring in domain (binance-verify, coinbase-aml)
    if (dl.length > target.length && dl.includes(target)) {
      results.push({ target: target, type: 'substring' });
      continue;
    }

    // 3. Domain contains brand with separators (binance-exchange, coinbase_support)
    const brandClean = target.replace(/[^a-z0-9]/g, '');
    const domainClean = dl.replace(/[^a-z0-9]/g, '');
    if (domainClean.length > brandClean.length && domainClean.includes(brandClean)) {
      results.push({ target: target, type: 'contains-brand' });
    }
  }

  return results;
}

// Known mixer/high-risk labels
const KNOWN_MIXER_ADDRESSES = new Set([
  '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b', // Tornado Cash Router
  '0x722122df12d4e14e13ac3b6895a86e84145b6967', // Tornado Cash Proxy
]);

// --- HTTP helpers ---
function fetchJSON(url, timeout = 10000) {
  return new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error('timeout')), timeout);
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'RokoBot/2.0' } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        clearTimeout(timer);
        return fetchJSON(r.headers.location, timeout - 2000).then(res).catch(rej);
      }
      let b = '';
      r.on('data', d => b += d);
      r.on('end', () => { clearTimeout(timer); try { res(JSON.parse(b)); } catch { rej(new Error('parse')); } });
    }).on('error', e => { clearTimeout(timer); rej(e); });
  });
}

function fetchText(url, timeout = 8000) {
  return new Promise((res, rej) => {
    const timer = setTimeout(() => { rej(new Error('timeout')); }, timeout);
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RokoBot/2.0)' },
    }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        clearTimeout(timer);
        return fetchText(r.headers.location, timeout - 2000).then(res).catch(rej);
      }
      let b = '';
      r.on('data', d => { b += d; if (b.length > 50000) { r.destroy(); clearTimeout(timer); res(b); } });
      r.on('end', () => { clearTimeout(timer); res(b); });
    }).on('error', e => { clearTimeout(timer); rej(e); });
  });
}

// ============================================================
// BLOCKCHAIN ADDRESS DETECTION
// ============================================================

function detectAddressType(addr) {
  addr = addr.trim();
  // Bitcoin: starts with 1, 3 (P2SH), or bc1 (bech32)
  if (/^(bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(addr)) return 'btc';
  if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(addr)) return 'btc';
  // Ethereum: 0x + 40 hex chars
  if (/^0x[a-fA-F0-9]{40}$/.test(addr)) return 'eth';
  // TRON: starts with T, 34 chars base58
  if (/^T[a-zA-Z0-9]{33}$/.test(addr)) return 'tron';
  return null;
}

// ============================================================
// BITCOIN CHECK — mempool.space API (free, no key)
// ============================================================

async function checkBTC(address) {
  const results = [];
  let score = 40;

  if (SANCTIONED_ADDRESSES.has(address.toLowerCase()) || SANCTIONED_ADDRESSES.has(address)) {
    results.push(`🔴 <b>OFAC SANCTIONED ADDRESS</b> — do NOT transact`);
    return { score: 0, results, chain: 'BTC' };
  }

  try {
    const data = await fetchJSON(`https://mempool.space/api/address/${address}`);
    const stats = data.chain_stats || {};
    const funded = stats.funded_txo_sum || 0;
    const spent = stats.spent_txo_sum || 0;
    const balance = (funded - spent) / 1e8;
    const txCount = stats.tx_count || 0;
    const totalReceived = funded / 1e8;

    results.push(`💰 Balance: <b>${balance.toFixed(8)} BTC</b> (~$${(balance * 85000).toFixed(0)})`);
    results.push(`📊 Transactions: ${txCount} total, received ${totalReceived.toFixed(4)} BTC`);

    // TX count analysis
    if (txCount > 1000) {
      results.push(`🟢 High activity address (${txCount} txs) — likely operational`);
      score += 15;
    } else if (txCount > 50) {
      results.push(`🟢 Moderate activity (${txCount} txs)`);
      score += 10;
    } else if (txCount > 5) {
      score += 5;
    } else if (txCount < 3) {
      results.push(`🟡 Very low activity (${txCount} txs) — new or one-time address`);
      score -= 5;
    }

    // Sweep pattern
    if (txCount <= 2 && balance === 0 && totalReceived > 0) {
      results.push(`🟡 Funds received and immediately moved out — sweep pattern`);
      score -= 5;
    }

    // Large balance is a positive signal
    if (balance > 1) { score += 5; }
    if (balance > 10) { score += 5; }

  } catch (e) {
    results.push(`⚪ BTC check unavailable: ${esc(e.message)}`);
  }

  score = Math.max(0, Math.min(100, score));
  return { score, results, chain: 'BTC' };
}

// ============================================================
// ETHEREUM CHECK — LlamaRPC (free public RPC, no key)
// ============================================================

function ethRpcCallOnce(method, params) {
  return new Promise((res, rej) => {
    const postData = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const req = https.request('https://eth.llamarpc.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
      timeout: 10000,
    }, r => {
      let b = '';
      r.on('data', d => b += d);
      r.on('end', () => { try { const j = JSON.parse(b); res(j); } catch { rej(new Error('parse')); } });
    });
    req.on('error', rej);
    req.on('timeout', () => { req.destroy(); rej(new Error('timeout')); });
    req.write(postData);
    req.end();
  });
}

async function ethRpcCall(method, params, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await ethRpcCallOnce(method, params);
      if (r.result !== undefined) return r;
      if (i < retries) await new Promise(ok => setTimeout(ok, 500));
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(ok => setTimeout(ok, 500));
    }
  }
  return {};
}

async function checkETH(address) {
  const results = [];
  let score = 40;
  const addrLower = address.toLowerCase();

  if (SANCTIONED_ADDRESSES.has(addrLower)) {
    results.push(`🔴 <b>OFAC SANCTIONED ADDRESS</b> — do NOT transact`);
    return { score: 0, results, chain: 'ETH' };
  }

  if (KNOWN_MIXER_ADDRESSES.has(addrLower)) {
    results.push(`🔴 <b>Known mixer/tumbler contract</b> — high AML risk`);
    score -= 30;
  }

  // Run balance + txCount + USDT balance in parallel via RPC
  const [balRes, txRes, usdtRes, codeRes] = await Promise.allSettled([
    ethRpcCall('eth_getBalance', [address, 'latest']),
    ethRpcCall('eth_getTransactionCount', [address, 'latest']),
    ethRpcCall('eth_call', [{ to: USDT_ERC20, data: '0x70a08231' + addrLower.replace('0x', '').padStart(64, '0') }, 'latest']),
    ethRpcCall('eth_getCode', [address, 'latest']),
  ]);

  // Balance
  if (balRes.status === 'fulfilled' && balRes.value.result) {
    const balanceETH = parseInt(balRes.value.result, 16) / 1e18;
    results.push(`💰 Balance: <b>${balanceETH.toFixed(4)} ETH</b> (~$${(balanceETH * 3500).toFixed(0)})`);
    if (balanceETH > 1) score += 5;
    if (balanceETH > 10) score += 5;
  } else {
    results.push(`⚪ ETH balance unavailable`);
  }

  // TX count
  if (txRes.status === 'fulfilled' && txRes.value.result) {
    const txCount = parseInt(txRes.value.result, 16);
    results.push(`📊 Transactions: ${txCount}`);
    if (txCount > 500) { score += 10; }
    else if (txCount > 20) { score += 5; }
    else if (txCount < 3) { results.push(`🟡 Very low activity (${txCount} txs)`); score -= 5; }
  }

  // Contract check
  if (codeRes.status === 'fulfilled' && codeRes.value.result && codeRes.value.result !== '0x') {
    results.push(`📋 This is a <b>smart contract</b>`);
  }

  // USDT ERC-20 balance
  if (usdtRes.status === 'fulfilled' && usdtRes.value.result) {
    const usdtBalance = parseInt(usdtRes.value.result, 16) / 1e6;
    if (usdtBalance > 0) {
      results.push(`💵 USDT (ERC-20): <b>${usdtBalance.toLocaleString()}</b>`);
      if (usdtBalance > 100000) { results.push(`🟢 Significant USDT holdings`); score += 5; }
    } else {
      results.push(`💵 USDT (ERC-20): 0`);
    }
  }

  score = Math.max(0, Math.min(100, score));
  return { score, results, chain: 'ETH' };
}

// ============================================================
// TRON CHECK — TronGrid API (free, no key for basic queries)
// ============================================================

async function checkTRON(address) {
  const results = [];
  let score = 40;

  if (SANCTIONED_ADDRESSES.has(address)) {
    results.push(`🔴 <b>OFAC SANCTIONED ADDRESS</b> — do NOT transact`);
    return { score: 0, results, chain: 'TRON' };
  }

  try {
    const data = await fetchJSON(`https://api.trongrid.io/v1/accounts/${address}`);

    if (!data?.data || data.data.length === 0) {
      results.push(`⚪ Address not found on TRON — may be unused`);
      return { score: 20, results, chain: 'TRON' };
    }

    const info = data.data[0];
    const balanceTRX = (info.balance || 0) / 1e6;
    const createTime = info.create_time;

    results.push(`💰 Balance: <b>${balanceTRX.toFixed(2)} TRX</b> (~$${(balanceTRX * 0.25).toFixed(2)})`);

    // Check TRC-20 tokens (USDT)
    const trc20 = info.trc20 || [];
    const usdtEntry = trc20.find(t => t[USDT_TRC20] !== undefined);
    if (usdtEntry) {
      const usdtBalance = parseInt(usdtEntry[USDT_TRC20]) / 1e6;
      results.push(`💵 USDT (TRC-20): <b>${usdtBalance.toLocaleString()}</b>`);
      if (usdtBalance > 50000) { results.push(`🟢 Significant USDT holdings`); score += 10; }
      else if (usdtBalance > 1000) { score += 5; }
    } else {
      results.push(`💵 USDT (TRC-20): 0`);
    }

    if (createTime) {
      const created = new Date(createTime);
      const age = (Date.now() - created.getTime()) / (365.25 * 24 * 3600000);
      if (age >= 1) { results.push(`🟢 Account age: ${age.toFixed(1)} years`); score += 15; }
      else if (age >= 0.08) { results.push(`🟡 Account age: ${Math.round(age * 12)} months`); score += 5; }
      else { results.push(`🔴 Account age: ${Math.round(age * 365)} days — very new`); score -= 10; }
    }

    // Frozen resources = invested in network
    if (info.frozenV2 && info.frozenV2.some(f => f.amount > 0)) {
      results.push(`🟢 Has staked TRX — invested in network`);
      score += 5;
    }

    // Balance signals
    if (balanceTRX > 10000) score += 5;

  } catch (e) {
    results.push(`⚪ TRON check unavailable: ${esc(e.message)}`);
  }

  score = Math.max(0, Math.min(100, score));
  return { score, results, chain: 'TRON' };
}

// ============================================================
// AML CHECK — OFAC SDN list + known mixer/scam databases
// ============================================================

async function checkAML(address, chain) {
  const results = [];
  const addrLower = address.toLowerCase();

  // Check local sanctions DB
  if (SANCTIONED_ADDRESSES.has(addrLower) || SANCTIONED_ADDRESSES.has(address)) {
    results.push(`🔴 <b>AML: OFAC SANCTIONED</b> — this address is on the SDN list`);
    results.push(`⛔ Transacting with this address may violate US/EU sanctions laws`);
    return { sanctioned: true, results, riskLevel: 'critical' };
  }

  // Check mixer addresses
  if (KNOWN_MIXER_ADDRESSES.has(addrLower)) {
    results.push(`🔴 <b>AML: Known mixer/tumbler</b> — high money laundering risk`);
    return { sanctioned: false, results, riskLevel: 'high' };
  }

  results.push(`🟢 AML: Not found in OFAC sanctions or known mixer databases`);
  results.push(`💡 For a deep AML check (transaction history, risk score) → @AMLBot`);
  return { sanctioned: false, results, riskLevel: 'low' };
}

// ============================================================
// WALLET APPROVAL SCANNER
// ============================================================

// Check ERC-20 token approvals for an Ethereum address
async function checkETHApprovals(address) {
  const results = [];

  try {
    results.push(`\n🔍 <b>Token Approval Scanner (ETH)</b>`);

    const paddedAddr = address.toLowerCase().replace('0x', '').padStart(64, '0');
    const approvalTopic = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';

    // Get current block number first to calculate range
    const blockRes = await ethRpcCall('eth_blockNumber', []);
    if (!blockRes?.result) { results.push(`⚪ Approval scan unavailable`); return results; }

    const currentBlock = parseInt(blockRes.result, 16);
    // Scan last ~30 days (~200000 blocks at ~13s/block)
    const fromBlock = '0x' + Math.max(0, currentBlock - 200000).toString(16);

    const logsResult = await ethRpcCall('eth_getLogs', [{
      address: USDT_ERC20,
      topics: [approvalTopic, '0x' + paddedAddr],
      fromBlock,
      toBlock: 'latest',
    }]);

    if (logsResult?.result && logsResult.result.length > 0) {
      const approvals = logsResult.result;
      const activeApprovals = [];

      for (const log of approvals.slice(-10)) {
        const spender = '0x' + (log.topics[2] || '').slice(26);
        const amount = parseInt(log.data, 16);
        const isUnlimited = amount > 1e15;

        if (isUnlimited) activeApprovals.push({ spender, unlimited: true });
        else if (amount > 0) activeApprovals.push({ spender, amount: amount / 1e6, unlimited: false });
      }

      const unlimited = activeApprovals.filter(a => a.unlimited);
      if (unlimited.length > 0) {
        results.push(`🔴 <b>${unlimited.length} UNLIMITED approval(s) found!</b>`);
        results.push(`⚠️ These contracts can drain your USDT:`);
        for (const a of unlimited.slice(0, 3)) {
          const short = a.spender.slice(0, 10) + '...' + a.spender.slice(-6);
          const isBad = SANCTIONED_ADDRESSES.has(a.spender.toLowerCase());
          results.push(`  ${isBad ? '🔴' : '🟡'} ${esc(short)}${isBad ? ' — SANCTIONED!' : ''}`);
        }
        results.push(`\n💡 <b>Revoke:</b> revoke.cash`);
      }

      const limited = activeApprovals.filter(a => !a.unlimited);
      if (limited.length > 0) {
        results.push(`ℹ️ ${limited.length} limited approval(s) — normal for DEX usage`);
      }

      if (unlimited.length === 0 && limited.length === 0) {
        results.push(`🟢 Recent approvals are all zeroed — clean`);
      }
    } else {
      results.push(`🟢 No recent USDT approvals (last 30 days) — clean`);
    }

  } catch (e) {
    results.push(`⚪ ETH approval scan unavailable: ${esc(e.message)}`);
  }

  return results;
}

// Check TRC-20 approvals on TRON via TronGrid events API
async function checkTRONApprovals(address) {
  const results = [];

  try {
    results.push(`\n🔍 <b>Token Approval Scanner (TRON)</b>`);

    // Query Approval events from the USDT TRC-20 contract for this address
    const data = await fetchJSON(
      `https://api.trongrid.io/v1/contracts/${USDT_TRC20}/events?event_name=Approval&block_timestamp_min=${Date.now() - 90 * 86400000}&limit=50`
    );

    // TronGrid events API returns all approvals — filter by owner
    // This is less efficient but works without auth
    // Alternative: check allowance directly via contract call
    // For now, show a helpful message
    results.push(`ℹ️ TRON approval data requires TronScan Pro`);
    results.push(`💡 Check approvals: tronscan.org/#/address/${esc(address)} → Approvals tab`);
    results.push(`💡 Or use: tronlink.org wallet → Approval Management`);

  } catch (e) {
    results.push(`⚪ TRON approval scan: ${esc(e.message)}`);
  }

  return results;
}

// ============================================================
// UNIFIED ADDRESS CHECK
// ============================================================

async function checkAddress(address) {
  const chain = detectAddressType(address);
  if (!chain) return null;

  let chainResult;
  if (chain === 'btc') chainResult = await checkBTC(address);
  else if (chain === 'eth') chainResult = await checkETH(address);
  else if (chain === 'tron') chainResult = await checkTRON(address);

  // Run AML check in parallel with approval scan
  const [amlResult, approvals] = await Promise.all([
    checkAML(address, chain),
    chain === 'eth' ? checkETHApprovals(address) :
    chain === 'tron' ? checkTRONApprovals(address) :
    Promise.resolve([]),
  ]);

  // Merge results
  const results = [...chainResult.results];

  // AML section
  results.push(`\n🛡️ <b>AML Screening</b>`);
  results.push(...amlResult.results);

  // Approvals section (only for ETH/TRON)
  if (approvals.length > 0) {
    results.push(...approvals);
  }

  // Adjust score based on AML
  let score = chainResult.score;
  if (amlResult.sanctioned) score = 0;

  score = Math.max(0, Math.min(100, score));

  let emoji, label;
  if (score >= 70) { emoji = '🟢'; label = 'Low risk'; }
  else if (score >= 40) { emoji = '🟡'; label = 'Medium risk'; }
  else { emoji = '🔴'; label = 'High risk'; }

  const chainNames = { btc: 'Bitcoin', eth: 'Ethereum', tron: 'TRON' };
  return { score, emoji, label, results, chain: chainNames[chain], address };
}

// ============================================================
// DOMAIN CHECK ENGINE (unchanged from v3)
// ============================================================

async function checkDomain(domain) {
  const results = [];
  let score = 50;
  const dl = domain.toLowerCase();

  if (KNOWN_SCAM[dl]) {
    results.push(`🔴 <b>SANCTIONED/SCAM:</b> ${esc(KNOWN_SCAM[dl])}`);
    score -= 40;
  }
  if (KNOWN_GOOD[dl]) {
    results.push(`🟢 ${esc(KNOWN_GOOD[dl].note)}`);
    score += KNOWN_GOOD[dl].boost;
  }
  if (KNOWN_WARN[dl]) {
    results.push(`🟡 ${esc(KNOWN_WARN[dl])}`);
    score -= 10;
  }

  // Phishing detection — check similarity to known brands
  if (!KNOWN_GOOD[dl] && !KNOWN_SCAM[dl]) {
    const phishing = checkPhishing(domain);
    if (phishing.length > 0) {
      const p = phishing[0];
      const brandDomain = PHISHING_TARGETS.includes(p.target)
        ? safeDomainsData.find(d => d.domain.startsWith(p.target))?.domain || p.target + '.com'
        : p.target + '.com';
      if (p.type === 'typosquat') {
        results.push(`🔴 <b>PHISHING ALERT:</b> this domain looks like ${esc(brandDomain)} (${p.distance} character${p.distance > 1 ? 's' : ''} different)`);
        score -= 25;
      } else {
        results.push(`🟡 <b>Impersonation risk:</b> domain contains brand name "${esc(p.target)}" — verify this is the official site`);
        score -= 15;
      }
    }
  }

  const [dnsResult, rdapResult, sslResult, siteResult] = await Promise.allSettled([
    checkDNS(domain), checkRDAP(domain), checkSSL(domain), scanSite(domain),
  ]);

  if (dnsResult.status === 'fulfilled' && dnsResult.value) {
    const dns = dnsResult.value;
    if (dns.resolves) {
      results.push(`🟢 DNS resolves → ${esc(dns.ip)}`);
      score += 3;
      if (dns.cloudflare) results.push(`ℹ️ Behind Cloudflare — real server IP hidden`);
    } else {
      results.push(`🔴 DNS does not resolve — site may be down or seized`);
      score -= 25;
    }
  } else {
    results.push(`⚪ DNS check: unavailable`);
  }

  if (rdapResult.status === 'fulfilled' && rdapResult.value) {
    const age = rdapResult.value;
    if (age.years >= 3) { results.push(`🟢 Domain age: ${esc(age.text)} — well established`); score += 15; }
    else if (age.years >= 1) { results.push(`🟢 Domain age: ${esc(age.text)}`); score += 8; }
    else if (age.years >= 0.25) { results.push(`🟡 Domain age: ${esc(age.text)} — relatively new`); score -= 5; }
    else { results.push(`🔴 Domain age: ${esc(age.text)} — very new, higher risk`); score -= 15; }
    if (age.registrar) results.push(`ℹ️ Registrar: ${esc(age.registrar)}`);
  } else {
    const whois = await checkWHOIS(domain);
    if (whois) {
      if (whois.years >= 3) { results.push(`🟢 Domain age: ${esc(whois.text)} (WHOIS)`); score += 15; }
      else if (whois.years >= 1) { results.push(`🟢 Domain age: ${esc(whois.text)} (WHOIS)`); score += 8; }
      else if (whois.years >= 0.25) { results.push(`🟡 Domain age: ${esc(whois.text)} (WHOIS) — relatively new`); score -= 5; }
      else { results.push(`🔴 Domain age: ${esc(whois.text)} (WHOIS) — very new`); score -= 15; }
      if (whois.registrar) results.push(`ℹ️ Registrar: ${esc(whois.registrar)}`);
    } else {
      results.push(`⚪ Domain age: could not determine`);
    }
  }

  if (sslResult.status === 'fulfilled') {
    const ssl = sslResult.value;
    if (ssl.valid) { results.push(`🟢 SSL: valid, HTTPS works`); score += 5; }
    else { results.push(`🟡 SSL: ${esc(ssl.error)}`); score -= 5; }
  }

  let siteHtml = '';
  if (siteResult.status === 'fulfilled' && siteResult.value) {
    for (const finding of siteResult.value.findings) {
      results.push(finding.text);
      score += finding.scoreAdj;
    }
    siteHtml = siteResult.value.html || '';
  }

  // AI content analysis (non-blocking — graceful degradation)
  if (siteHtml && siteHtml.length > 100) {
    try {
      const aiResult = await scanSiteAI(domain, siteHtml);
      if (aiResult && aiResult.confidence >= 0.6) {
        const cat = aiResult.category;
        if (cat === 'aml_drain') {
          results.push(`🔴 <b>AI: AML-drain detected</b> — site asks to connect wallet for fake "AML verification"`);
          if (aiResult.summary) results.push(`ℹ️ ${esc(aiResult.summary)}`);
          score -= 30;
        } else if (cat === 'token_drain') {
          results.push(`🔴 <b>AI: Token drain risk</b> — site may request dangerous token approvals`);
          if (aiResult.summary) results.push(`ℹ️ ${esc(aiResult.summary)}`);
          score -= 25;
        } else if (cat === 'phishing') {
          results.push(`🔴 <b>AI: Phishing detected</b> — site impersonates a known brand`);
          if (aiResult.summary) results.push(`ℹ️ ${esc(aiResult.summary)}`);
          score -= 25;
        } else if (cat === 'scam_exchange') {
          results.push(`🟡 <b>AI: Suspicious exchange</b> — unrealistic claims detected`);
          if (aiResult.summary) results.push(`ℹ️ ${esc(aiResult.summary)}`);
          score -= 15;
        } else if (cat === 'legitimate' && aiResult.confidence >= 0.8) {
          results.push(`🟢 AI: Site content looks legitimate`);
          score += 5;
        }
      }
    } catch {
      // AI unavailable — continue with deterministic checks only
    }
  }

  score = Math.max(0, Math.min(100, score));
  let emoji, label;
  if (score >= 70) { emoji = '🟢'; label = 'Low risk'; }
  else if (score >= 40) { emoji = '🟡'; label = 'Medium risk'; }
  else { emoji = '🔴'; label = 'High risk'; }

  return { score, emoji, label, results, domain };
}

// --- Individual domain checks ---

async function checkDNS(domain) {
  const dns = await fetchJSON(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`);
  if (dns.Answer && dns.Answer.length > 0) {
    const ip = dns.Answer[dns.Answer.length - 1].data;
    const cloudflare = dns.Answer.some(a => {
      const p = (a.data || '').split('.');
      return ['104', '172', '173', '188'].includes(p[0]);
    });
    return { resolves: true, ip, cloudflare };
  }
  return { resolves: false };
}

async function checkRDAP(domain) {
  const rdap = await fetchJSON(`https://rdap.org/domain/${encodeURIComponent(domain)}`);
  const regEvent = (rdap.events || []).find(e => e.eventAction === 'registration');
  if (!regEvent) return null;
  const regDate = new Date(regEvent.eventDate);
  const years = (Date.now() - regDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  const text = years >= 1 ? `${years.toFixed(1)} years (since ${regDate.getFullYear()})` : years >= (1/12) ? `${Math.round(years * 12)} months` : `${Math.round(years * 365)} days`;
  let registrar = null;
  const regEntity = (rdap.entities || []).find(e => (e.roles || []).includes('registrar'));
  if (regEntity?.vcardArray?.[1]) {
    const fn = regEntity.vcardArray[1].find(item => item[0] === 'fn');
    if (fn) registrar = fn[3];
  }
  return { years, text, date: regDate, registrar };
}

async function checkWHOIS(domain) {
  try {
    const raw = execFileSync('whois', [domain], { timeout: 10000, encoding: 'utf8' });
    const creationMatch = raw.match(/Creation Date:\s*(.+)/i) || raw.match(/created:\s*(.+)/i);
    const registrarMatch = raw.match(/Registrar:\s*(.+)/i);
    if (creationMatch) {
      const regDate = new Date(creationMatch[1].trim());
      if (isNaN(regDate)) return null;
      const years = (Date.now() - regDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      const text = years >= 1 ? `${years.toFixed(1)} years (since ${regDate.getFullYear()})` : years >= (1/12) ? `${Math.round(years * 12)} months` : `${Math.round(years * 365)} days`;
      return { years, text, registrar: registrarMatch ? registrarMatch[1].trim() : null };
    }
    return null;
  } catch { return null; }
}

async function checkSSL(domain) {
  return new Promise(res => {
    const req = https.request({ hostname: domain, port: 443, method: 'HEAD', timeout: 5000 }, () => res({ valid: true }));
    req.on('error', () => res({ valid: false, error: 'HTTPS unavailable or certificate error' }));
    req.on('timeout', () => { req.destroy(); res({ valid: false, error: 'Connection timeout' }); });
    req.end();
  });
}

async function scanSite(domain) {
  const findings = [];
  let rawHtml = '';
  try {
    const html = await fetchText(`https://${domain}`);
    rawHtml = html;
    const titleMatch = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    const siteTitle = titleMatch ? titleMatch[1].trim() : '';
    const emails = [...new Set((html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []))];
    const domainBase = domain.replace(/\.(com|io|net|org|cc|me|pro|exchange|trade|app|site|online|xyz)$/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const titleClean = siteTitle.replace(/[^a-z0-9]/gi, '').toLowerCase();

    if (siteTitle && domainBase.length > 3 && titleClean.length > 3) {
      const domainInTitle = titleClean.includes(domainBase) || domainBase.includes(titleClean.slice(0, 6));
      if (!domainInTitle && !titleClean.includes(domainBase.slice(0, 5))) {
        findings.push({ text: `🔴 <b>Brand mismatch:</b> domain "${esc(domain)}" but title says "${esc(siteTitle)}"`, scoreAdj: -12 });
      }
    }
    if (emails.length > 0) {
      const mismatch = emails.filter(e => { const d = e.split('@')[1].toLowerCase(); return d !== domain && !d.includes(domainBase) && !domainBase.includes(d.split('.')[0]); });
      if (mismatch.length > 0) findings.push({ text: `🟡 Contact email on different domain: ${esc(mismatch[0])}`, scoreAdj: -5 });
    }
    if (emails.length === 0 && !html.match(/contact|support|email|mailto/i)) {
      findings.push({ text: `🟡 No contact information found on homepage`, scoreAdj: -5 });
    }
    if (html.match(/guaranteed\s+(profit|return|income)/i) || html.match(/100%\s+(safe|secure|guaranteed)/i)) {
      findings.push({ text: `🔴 Suspicious claims: "guaranteed profit" or "100% safe"`, scoreAdj: -10 });
    }
    if (html.match(/u-body|nicepage|wix\.com|squarespace|tilda\.ws/i)) {
      findings.push({ text: `🟡 Built with a website builder/template`, scoreAdj: -3 });
    }
    if (html.match(/\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/) || html.match(/\b0x[a-fA-F0-9]{40}\b/) || html.match(/\bT[a-zA-Z0-9]{33}\b/)) {
      findings.push({ text: `🟡 Crypto address found on homepage — verify before sending`, scoreAdj: -3 });
    }
    if (siteTitle) findings.push({ text: `ℹ️ Site title: "${esc(siteTitle.slice(0, 80))}"`, scoreAdj: 0 });
  } catch (err) {
    if (err.message === 'timeout') findings.push({ text: `🟡 Site is very slow to respond`, scoreAdj: -3 });
  }
  return { findings, html: rawHtml };
}

// --- AI SITE ANALYSIS (via LLM orchestrator) ---
let llmInstance = null;
let llmAvailable = null; // null = untested, true/false

async function initLLM() {
  if (llmAvailable === false) return null;
  if (llmInstance) return llmInstance;
  try {
    const { init } = require('/Users/roman/Projects/LLM/lib/index.cjs');
    const { LLM } = await init();
    llmInstance = new LLM({ project: 'roko' });
    llmAvailable = true;
    console.log('🤖 LLM orchestrator connected');
    return llmInstance;
  } catch (e) {
    llmAvailable = false;
    console.log('⚠️ LLM orchestrator unavailable — AI analysis disabled');
    return null;
  }
}

const SITE_ANALYSIS_PROMPT = `You are a crypto security analyst. Classify this website's text content.

Categories:
- legitimate: real crypto exchange or service
- aml_drain: asks to "verify wallet" / "connect for AML check" / approve tokens for supposed compliance
- phishing: impersonates a known brand (Binance, Coinbase, etc.)
- scam_exchange: fake exchange with unrealistic promises, guaranteed returns
- token_drain: requests token approvals or wallet connection that could drain funds
- info: educational/news site, not an exchange

Red flags:
- "Connect wallet" for verification/AML/compliance
- Token approval requests disguised as security
- Guaranteed returns or unrealistic rates
- Urgency ("limited time", "act now")
- Requests for seed phrase or private key
- Claims of "free" tokens/airdrops requiring wallet connection

Reply ONLY with valid JSON:
{"category":"...","confidence":0.0-1.0,"flags":["flag1","flag2"],"summary":"1-2 sentences explaining the risk to a regular person"}

Website text:
`;

async function scanSiteAI(domain, html) {
  const llm = await initLLM();
  if (!llm) return null;

  // Strip HTML to readable text, limit size
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000);

  if (text.length < 50) return null;

  try {
    const result = await llm.chat({
      model: 'gemini-2.5-flash-lite', // Free tier — no API costs
      task: 'site-classify',
      messages: [{ role: 'user', content: SITE_ANALYSIS_PROMPT + text }],
      max_tokens: 300,
      temperature: 0,
    });

    // Parse JSON from response (handle markdown code blocks)
    const jsonStr = (typeof result === 'string' ? result : result?.text || '')
      .replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.log(`⚠️ AI analysis failed for ${domain}: ${e.message}`);
    return null;
  }
}

async function generateRiskSummary(target, checks, score, lang) {
  const llm = await initLLM();
  if (!llm) return null;

  const context = checks.join('\n');
  const langName = lang === 'ru' ? 'Russian' : lang === 'es' ? 'Spanish' : 'English';

  try {
    const result = await llm.chat({
      model: 'gemini-2.5-flash-lite', // Free tier — no API costs
      task: 'risk-summary',
      messages: [{ role: 'user', content:
        `Security check results for "${target}":\n${context}\n` +
        `Score: ${score}/100\n\n` +
        `Write 2-3 sentences in ${langName} explaining the risk to a regular person (not a crypto expert). ` +
        `Be specific about what's dangerous and what to do. No markdown, plain text only.`
      }],
      max_tokens: 200,
      temperature: 0.3,
    });

    return typeof result === 'string' ? result.trim() : (result?.text || '').trim();
  } catch {
    return null;
  }
}

// --- TELEGRAM HANDLE CHECK ---
async function checkTelegramHandle(handle) {
  const results = [];
  let score = 30;

  try {
    const html = await fetchText(`https://t.me/${handle}`);
    if (html.includes('tgme_page_title') || html.includes('tgme_channel_info')) {
      const nameMatch = html.match(/tgme_page_title[^>]*>([^<]+)/);
      const name = nameMatch ? nameMatch[1].trim() : '';
      const descMatch = html.match(/tgme_page_description[^>]*>([^<]{0,200})/);
      const desc = descMatch ? descMatch[1].trim() : '';
      const isChannel = html.includes('tgme_channel_info');
      const membersMatch = html.match(/([\d\s]+)\s*(?:members|subscribers)/i);

      results.push(`🟢 Account exists: ${esc(name || handle)}`);
      if (isChannel) results.push(`ℹ️ This is a channel/group`);
      if (membersMatch) results.push(`ℹ️ ${membersMatch[1].trim()} members`);
      if (desc) results.push(`ℹ️ Bio: "${esc(desc.slice(0, 120))}"`);
      score += 10;

      const combined = (name + ' ' + desc).toLowerCase();
      if (combined.match(/guaranteed|100%|profit|безопасн/)) { results.push(`🟡 Suspicious language`); score -= 5; }
      if (combined.match(/manager|support|admin|operator/)) { results.push(`🟡 Generic "manager/support" naming — could be impersonation`); score -= 5; }
    } else if (html.includes('page_not_found')) {
      results.push(`🔴 Account @${esc(handle)} does not exist or was deleted`);
      score -= 20;
    } else {
      results.push(`🟢 Account @${esc(handle)} exists (personal account)`);
      score += 5;
    }
  } catch {
    results.push(`⚪ Could not fetch Telegram profile`);
  }

  if (handle.match(/^\d+$/)) { results.push(`🔴 Username is just numbers — suspicious`); score -= 10; }
  if (handle.match(/manager|support|admin|operator|helper/i)) { results.push(`🟡 "manager/support" in name — common scam trick`); score -= 5; }
  if (handle.length > 20) { results.push(`🟡 Very long username — unusual`); score -= 3; }
  const brandMatch = handle.match(/(binance|coinbase|bybit|kraken|bestchange|trust|wallet)/i);
  if (brandMatch) { results.push(`🔴 Contains "${esc(brandMatch[1])}" — pretending to be a known exchange?`); score -= 10; }

  score = Math.max(0, Math.min(100, score));
  let emoji, label;
  if (score >= 60) { emoji = '🟢'; label = 'Likely legitimate'; }
  else if (score >= 35) { emoji = '🟡'; label = 'Proceed with caution'; }
  else { emoji = '🔴'; label = 'High risk'; }

  return { score, emoji, label, results, handle };
}

// ============================================================
// SAFETY TIPS — short, actionable
// ============================================================

function getGuide(score, context = 'online', chatId) {
  if (context === 'offline') {
    if (score < 40) return [t('guide_offline_bad', chatId)];
    return t('guide_offline', chatId);
  }
  if (context === 'wallet') {
    const tips = [t('guide_wallet', chatId)];
    if (score < 40) tips.push(t('guide_wallet_bad', chatId));
    return tips;
  }
  if (score >= 70) return [t('guide_hi', chatId)];
  if (score >= 40) return t('guide_mid', chatId);
  return t('guide_lo', chatId);
}

// ============================================================
// WATCHLIST / MONITORING
// ============================================================

function addToWatchlist(chatId, type, value) {
  if (!watchlist[chatId]) watchlist[chatId] = [];
  // Check duplicates
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

// Monitoring loop — checks watchlist items periodically
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
      } catch {} // Don't crash monitoring on individual failures
    }
  }
}

// Run monitoring every 30 minutes
setInterval(monitorLoop, 30 * 60 * 1000);

// ============================================================
// ============================================================
// RATE LIMITER — per-user, in-memory
// ============================================================
const RATE_LIMIT = { maxChecks: 5, windowMs: 60000, maxDaily: 50 }; // 5 checks/min, 50/day
const rateBuckets = new Map(); // chatId → { checks: [{ts}], dailyCount, dayKey }

function rateCheck(chatId) {
  const now = Date.now(), dayKey = new Date().toISOString().slice(0, 10);
  let b = rateBuckets.get(chatId);
  if (!b || b.dayKey !== dayKey) b = { checks: [], dailyCount: 0, dayKey };
  b.checks = b.checks.filter(ts => now - ts < RATE_LIMIT.windowMs);
  if (b.dailyCount >= RATE_LIMIT.maxDaily) { rateBuckets.set(chatId, b); return 'daily'; }
  if (b.checks.length >= RATE_LIMIT.maxChecks) { rateBuckets.set(chatId, b); return 'minute'; }
  b.checks.push(now);
  b.dailyCount++;
  rateBuckets.set(chatId, b);
  return null;
}

// Cleanup stale entries every hour
setInterval(() => { const day = new Date().toISOString().slice(0, 10); for (const [k, v] of rateBuckets) { if (v.dayKey !== day) rateBuckets.delete(k); } }, 3600000);

const RATE_MSG = {
  minute: { en: '⏳ Too many requests — wait a minute.', ru: '⏳ Слишком много запросов — подожди минуту.', es: '⏳ Demasiadas solicitudes — espera un minuto.' },
  daily: { en: '⏳ Daily limit reached (50 checks). Try again tomorrow.', ru: '⏳ Дневной лимит (50 проверок). Попробуй завтра.', es: '⏳ Límite diario alcanzado (50 verificaciones). Intenta mañana.' },
};

// ============================================================
// MESSAGE HANDLER
// ============================================================

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  if (!text) return;

  // --- Language ---
  if (text === '/lang' || text === '/language') {
    return send(chatId, t('lang_choose', chatId), {
      reply_markup: { inline_keyboard: [[
        { text: '🇬🇧 English', callback_data: 'lang_en' },
        { text: '🇷🇺 Русский', callback_data: 'lang_ru' },
        { text: '🇪🇸 Español', callback_data: 'lang_es' },
      ]] }
    });
  }

  // --- Commands ---
  if (text === '/start') {
    return send(chatId, t('start', chatId), {
      reply_markup: { inline_keyboard: [
        [{ text: '🦝 Open Roko App', web_app: { url: 'https://roko-help.web.app/app.html' } }],
        [{ text: '🌐 roko.help', url: 'https://roko.help' }],
        [
          { text: '🇬🇧', callback_data: 'lang_en' },
          { text: '🇷🇺', callback_data: 'lang_ru' },
          { text: '🇪🇸', callback_data: 'lang_es' },
        ],
      ]}
    });
  }

  if (text === '/help') {
    return send(chatId, t('help', chatId), {
      reply_markup: { inline_keyboard: [[
        { text: '📢 @roko_help', url: 'https://t.me/roko_help' },
        { text: '🌐 roko.help', url: 'https://roko.help' },
      ]]}
    });
  }

  // --- Watchlist commands ---
  if (text.startsWith('/watch ') && !text.startsWith('/watchlist')) {
    const target = text.slice(7).trim();
    if (!target) return send(chatId, t('watch_use', chatId));

    const addrType = detectAddressType(target);
    const isDomain = /^[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}$/.test(target);

    if (!addrType && !isDomain) {
      return send(chatId, t('watch_unrecognized', chatId));
    }

    const result = addToWatchlist(String(chatId), addrType ? 'address' : 'domain', target);
    if (result === true) {
      return send(chatId, t('watch_added', chatId, esc(target), esc(target)));
    } else if (result === false) {
      return send(chatId, t('watch_exists', chatId));
    } else {
      return send(chatId, t('watch_limit', chatId));
    }
  }

  if (text.startsWith('/unwatch ')) {
    const target = text.slice(9).trim();
    if (removeFromWatchlist(String(chatId), target)) {
      return send(chatId, t('unwatch_ok', chatId, esc(target)));
    }
    return send(chatId, t('unwatch_fail', chatId));
  }

  if (text === '/watchlist') {
    const items = getWatchlist(String(chatId));
    if (items.length === 0) return send(chatId, t('watchlist_empty', chatId));
    const list = items.map((w, i) => `${i + 1}. <code>${esc(w.value)}</code>`).join('\n');
    return send(chatId, `${t('watchlist_title', chatId, items.length)}\n\n${list}\n\n${t('watchlist_remove', chatId)}`);
  }

  // --- Approvals command ---
  if (text.startsWith('/approvals ')) {
    const addr = text.slice(11).trim();
    const addrType = detectAddressType(addr);
    if (addrType !== 'eth' && addrType !== 'tron') {
      return send(chatId, t('approvals_only', chatId));
    }

    await send(chatId, t('approvals_scanning', chatId));

    const approvals = addrType === 'eth'
      ? await checkETHApprovals(addr)
      : await checkTRONApprovals(addr);

    const guideText = getGuide(50, 'wallet', chatId).join('\n');
    return send(chatId,
      `🔓 <b>Approvals</b> · ${addrType === 'eth' ? 'ETH' : 'TRON'}\n` +
      `<code>${esc(addr.slice(0, 10))}...${esc(addr.slice(-6))}</code>\n\n` +
      approvals.join('\n') + '\n\n' +
      guideText
    );
  }

  // --- Detect crypto address ---
  const cleanText = text.replace(/^\/check\s*/i, '').trim();
  const addrType = detectAddressType(cleanText);

  // Rate limit before expensive checks
  if (addrType || cleanText.includes('.') || cleanText.startsWith('@')) {
    const limited = rateCheck(chatId);
    if (limited) return send(chatId, RATE_MSG[limited][getLang(chatId)] || RATE_MSG[limited].en);
  }

  if (addrType) {
    const chainName = { btc: 'Bitcoin', eth: 'Ethereum', tron: 'TRON' };
    await send(chatId, t('checking_addr', chatId, chainName[addrType]));

    try {
      const data = await checkAddress(cleanText);
      if (!data) return send(chatId, t('addr_fail', chatId));

      const checksText = data.results.join('\n');
      const guideText = getGuide(data.score, data.score < 40 ? 'wallet' : 'online', chatId).join('\n');
      const shortAddr = cleanText.slice(0, 10) + '...' + cleanText.slice(-6);

      const scoreLabel = data.score >= 70 ? t('score_hi', chatId) : data.score >= 40 ? t('score_mid', chatId) : t('score_lo', chatId);
      const rokoSays = data.score >= 70 ? t('roko_hi', chatId) : data.score >= 40 ? t('roko_mid', chatId) : data.score > 0 ? t('roko_lo', chatId) : t('roko_sanc', chatId);

      await send(chatId,
        `${data.emoji} <b>${esc(data.chain)}</b> · <code>${esc(shortAddr)}</code>\n` +
        `${t('trust', chatId)}: <b>${data.score}/100</b> · ${scoreLabel}\n\n` +
        `${checksText}\n\n` +
        `${rokoSays}\n\n` +
        `${guideText}`,
        { reply_markup: { inline_keyboard: [[
          { text: `📡 /watch`, callback_data: `watch_${cleanText.slice(0,58)}` },
          { text: t('web_btn', chatId), url: 'https://roko.help' },
        ]] }}
      );

      // Channel automation
      trackCheck(cleanText, data.score, scoreLabel, msg.from?.id);
      if (data.score < 20) alertScam(cleanText, data.score, checksText, msg.from?.id).catch(() => {});
      alertTrending(cleanText).catch(() => {});
    } catch (err) {
      await send(chatId, t('error', chatId, esc(err.message)));
    }
    return;
  }

  // --- Extract domain ---
  const domainMatch = cleanText.match(/(?:https?:\/\/)?([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,})/);
  const handleMatch = text.match(/@([a-zA-Z0-9_]{3,})/);

  if (domainMatch) {
    const domain = domainMatch[1].toLowerCase();
    await send(chatId, t('checking_domain', chatId, esc(domain)));

    try {
      const data = await checkDomain(domain);
      const checksText = data.results.join('\n');
      const guideText = getGuide(data.score, 'online', chatId).join('\n');

      const scoreLabel = data.score >= 70 ? t('score_hi', chatId) : data.score >= 40 ? t('score_mid', chatId) : t('score_lo', chatId);
      const rokoSays = data.score >= 70 ? t('roko_hi', chatId) : data.score >= 40 ? t('roko_mid', chatId) : data.score > 0 ? t('roko_lo', chatId) : t('roko_sanc', chatId);

      // Generate AI risk summary (non-blocking)
      let aiSummary = '';
      try {
        const summary = await generateRiskSummary(domain, data.results.map(r => r.replace(/<[^>]+>/g, '')), data.score, getLang(chatId));
        if (summary) aiSummary = `\n\n🤖 <i>${esc(summary)}</i>`;
      } catch {}

      await send(chatId,
        `${data.emoji} <b>${esc(data.domain)}</b>\n` +
        `${t('trust', chatId)}: <b>${data.score}/100</b> · ${scoreLabel}\n\n` +
        `${checksText}\n\n` +
        `${rokoSays}${aiSummary}\n\n` +
        `${guideText}`,
        { reply_markup: { inline_keyboard: [[
          { text: `📡 /watch`, callback_data: `watch_${domain.slice(0,58)}` },
          { text: t('web_btn', chatId), url: 'https://roko.help' },
        ]] }}
      );

      // Channel automation
      trackCheck(domain, data.score, scoreLabel, msg.from?.id);
      if (data.score < 20) alertScam(domain, data.score, checksText, msg.from?.id).catch(() => {});
      alertTrending(domain).catch(() => {});
    } catch (err) {
      await send(chatId, t('error', chatId, esc(err.message)));
    }
    return;
  }

  if (handleMatch) {
    const handle = handleMatch[1];
    await send(chatId, t('checking_handle', chatId, esc(handle)));

    try {
      const data = await checkTelegramHandle(handle);
      const checksText = data.results.join('\n');
      const guideText = getGuide(data.score, 'offline', chatId).join('\n');

      const scoreLabel = data.score >= 60 ? t('score_tg_hi', chatId) : data.score >= 35 ? t('score_tg_mid', chatId) : t('score_tg_lo', chatId);
      const rokoSays = data.score >= 60 ? t('roko_hi', chatId) : data.score >= 35 ? t('roko_mid', chatId) : data.score > 0 ? t('roko_lo', chatId) : t('roko_sanc', chatId);

      await send(chatId,
        `${data.emoji} <b>@${esc(data.handle)}</b>\n` +
        `${t('trust', chatId)}: <b>${data.score}/100</b> · ${scoreLabel}\n\n` +
        `${checksText}\n\n` +
        `${rokoSays}\n\n` +
        `${guideText}`,
        { reply_markup: { inline_keyboard: [[
          { text: `📡 /watch`, callback_data: `watch_@${handle.slice(0,57)}` },
          { text: t('web_btn', chatId), url: 'https://roko.help' },
        ]] }}
      );

      // Channel automation
      trackCheck('@' + handle, data.score, scoreLabel, msg.from?.id);
      if (data.score < 20) alertScam('@' + handle, data.score, checksText, msg.from?.id).catch(() => {});
      alertTrending('@' + handle).catch(() => {});
    } catch (err) {
      await send(chatId, t('error', chatId, esc(err.message)));
    }
    return;
  }

  // --- Fallback ---
  if (text.length > 2 && text.length < 80 && !text.startsWith('/')) {
    const guess = text.replace(/\s+/g, '').toLowerCase();
    if (guess.includes('.')) return handleMessage({ ...msg, text: guess });

    return send(chatId, t('fallback', chatId));
  }
}

// ============================================================
// CALLBACK HANDLER (inline buttons)
// ============================================================
async function handleCallback(cb) {
  const chatId = cb.message?.chat?.id;
  const data = cb.data;
  if (!chatId || !data) return;

  if (data.startsWith('lang_')) {
    const lang = data.slice(5);
    if (['en', 'ru', 'es'].includes(lang)) {
      setLang(chatId, lang);
      await tg('answerCallbackQuery', { callback_query_id: cb.id, text: t('lang_set', chatId) });
      await send(chatId, t('lang_set', chatId));
    }
    return;
  }

  if (data.startsWith('watch_')) {
    const target = data.slice(6);
    // Simulate /watch command
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: '📡' });
    await handleMessage({ chat: { id: chatId }, from: cb.from, text: `/watch ${target}` });
    return;
  }

  await tg('answerCallbackQuery', { callback_query_id: cb.id });
}

// ============================================================
// POLLING
// ============================================================

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

  // Weekly digest — every Monday at 10:00 UTC
  function scheduleDigest() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCDate(now.getUTCDate() + ((8 - now.getUTCDay()) % 7 || 7)); // next Monday
    next.setUTCHours(10, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 7);
    const ms = next - now;
    console.log(`   Next digest: ${next.toISOString()} (in ${Math.round(ms / 3600000)}h)`);
    setTimeout(() => { postDigest().catch(e => console.error('Digest:', e.message)); scheduleDigest(); }, ms);
  }
  scheduleDigest();

  poll();
}

// ─── Module mode vs standalone ─────────────────────────
if (require.main === module) {
  main();
} else {
  // Exported for Cloud Function wrapper (functions/index.js)
  module.exports = {
    handleMessage, handleCallback, monitorLoop, postDigest,
    // Persistence overrides — Cloud Function calls these to inject Firestore
    _overridePersistence(overrides) {
      if (overrides.userLangs) userLangs = overrides.userLangs;
      if (overrides.watchlist) watchlist = overrides.watchlist;
      if (overrides.stats) stats = overrides.stats;
      if (overrides.saveLangs) saveLangs = overrides.saveLangs;
      if (overrides.saveWatchlist) saveWatchlist = overrides.saveWatchlist;
      if (overrides.saveStats) saveStats = overrides.saveStats;
    },
    // Expose getters for data
    get userLangs() { return userLangs; },
    get watchlist() { return watchlist; },
    get stats() { return stats; },
  };
}
