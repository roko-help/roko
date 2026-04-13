// Main message and callback routing
const { tg, send, esc } = require('./telegram');
const { t, getLang, setLang } = require('./i18n');
const { RATE_LIMIT } = require('./config');
const { detectAddressType } = require('./data');
const { checkBTC } = require('./checks/btc');
const { checkETH } = require('./checks/eth');
const { checkTRON } = require('./checks/tron');
const { checkAML } = require('./checks/aml');
const { checkETHApprovals, checkTRONApprovals } = require('./checks/approvals');
const { checkDomain, generateRiskSummary } = require('./checks/domain');
const { checkTelegramHandle } = require('./checks/telegram');
const { trackCheck } = require('./stats');
const { addToWatchlist, removeFromWatchlist, getWatchlist } = require('./watchlist');
const { alertScam, alertTrending } = require('./channel');

// --- Unified address check ---
async function checkAddress(address) {
  const chain = detectAddressType(address);
  if (!chain) return null;

  let chainResult;
  if (chain === 'btc') chainResult = await checkBTC(address);
  else if (chain === 'eth') chainResult = await checkETH(address);
  else if (chain === 'tron') chainResult = await checkTRON(address);

  const [amlResult, approvals] = await Promise.all([
    checkAML(address, chain),
    chain === 'eth' ? checkETHApprovals(address) :
    chain === 'tron' ? checkTRONApprovals(address) :
    Promise.resolve([]),
  ]);

  const results = [...chainResult.results];
  results.push(`\n🛡️ <b>AML Screening</b>`);
  results.push(...amlResult.results);
  if (approvals.length > 0) {
    results.push(...approvals);
  }

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

// --- Safety tips ---
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
  if (score >= 40) { const tips = t('guide_mid', chatId); tips.push(t('exchange_cta', chatId)); return tips; }
  const tips = t('guide_lo', chatId); tips.push(t('exchange_cta', chatId)); return tips;
}

// --- Rate limiter ---
const rateBuckets = new Map();

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
  minute: { en: '⏳ Too many requests – wait a minute.', ru: '⏳ Слишком много запросов – подожди минуту.', es: '⏳ Demasiadas solicitudes – espera un minuto.' },
  daily: { en: '⏳ Daily limit reached (50 checks). Try again tomorrow.', ru: '⏳ Дневной лимит (50 проверок). Попробуй завтра.', es: '⏳ Límite diario alcanzado (50 verificaciones). Intenta mañana.' },
};

// --- Message handler ---
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  if (!text) return;

  if (text === '/lang' || text === '/language') {
    return send(chatId, t('lang_choose', chatId), {
      reply_markup: { inline_keyboard: [[
        { text: '🇬🇧 English', callback_data: 'lang_en' },
        { text: '🇷🇺 Русский', callback_data: 'lang_ru' },
        { text: '🇪🇸 Español', callback_data: 'lang_es' },
      ]] }
    });
  }

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

  const cleanText = text.replace(/^\/check\s*/i, '').trim();
  const addrType = detectAddressType(cleanText);

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

      trackCheck(cleanText, data.score, scoreLabel, msg.from?.id);
      if (data.score < 20) alertScam(cleanText, data.score, checksText, msg.from?.id).catch(() => {});
      alertTrending(cleanText).catch(() => {});
    } catch (err) {
      await send(chatId, t('error', chatId, esc(err.message)));
    }
    return;
  }

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

      trackCheck('@' + handle, data.score, scoreLabel, msg.from?.id);
      if (data.score < 20) alertScam('@' + handle, data.score, checksText, msg.from?.id).catch(() => {});
      alertTrending('@' + handle).catch(() => {});
    } catch (err) {
      await send(chatId, t('error', chatId, esc(err.message)));
    }
    return;
  }

  if (text.length > 2 && text.length < 80 && !text.startsWith('/')) {
    const guess = text.replace(/\s+/g, '').toLowerCase();
    if (guess.includes('.')) return handleMessage({ ...msg, text: guess });

    return send(chatId, t('fallback', chatId));
  }
}

// --- Callback handler ---
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
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: '📡' });
    await handleMessage({ chat: { id: chatId }, from: cb.from, text: `/watch ${target}` });
    return;
  }

  await tg('answerCallbackQuery', { callback_query_id: cb.id });
}

module.exports = { handleMessage, handleCallback };
