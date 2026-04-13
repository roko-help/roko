// Translations and language persistence
const { readFileSync, existsSync } = require('fs');
const fsPromises = require('fs').promises;
const { resolve } = require('path');

const LANG_PATH = resolve(__dirname, '..', 'langs.json');
let userLangs = {};
try { if (existsSync(LANG_PATH)) userLangs = JSON.parse(readFileSync(LANG_PATH, 'utf8')); } catch {}
let saveLangs = () => { fsPromises.writeFile(LANG_PATH, JSON.stringify(userLangs)).catch(() => {}); };

function getLang(chatId) { return userLangs[String(chatId)] || 'en'; }
function setLang(chatId, lang) { userLangs[String(chatId)] = lang; saveLangs(); }

const I = {
  start: {
    en: `🦝 <b>Roko</b> – checks sites, wallets, and Telegram contacts\n\nSend me anything:\n• Website → <code>bestchange.com</code>\n• Telegram → <code>@crypto_dealer</code>\n• Wallet → BTC, ETH or TRON address\n\nI check scam databases, blacklists, and blockchain – and tell you if it's safe.\n\nTry: <code>garantex.org</code>`,
    ru: `🦝 <b>Roko</b> – проверяет сайты, кошельки и Telegram-контакты\n\nОтправь мне что угодно:\n• Сайт → <code>bestchange.com</code>\n• Telegram → <code>@crypto_dealer</code>\n• Кошелёк → BTC, ETH или TRON адрес\n\nПроверю по базам мошенников, чёрным спискам и блокчейну – и скажу, можно ли доверять.\n\nПопробуй: <code>garantex.org</code>`,
    es: `🦝 <b>Roko</b> – verifica sitios, wallets y contactos de Telegram\n\nEnvíame lo que sea:\n• Sitio → <code>bestchange.com</code>\n• Telegram → <code>@crypto_dealer</code>\n• Wallet → dirección BTC, ETH o TRON\n\nVerifico bases de estafadores, listas negras y blockchain – y te digo si es seguro.\n\nPrueba: <code>garantex.org</code>`,
  },
  help: {
    en: `🦝 <b>Roko</b> – send a link, Telegram name, or wallet address.\n\n<b>What I check:</b>\n🌐 Website – is the site real, how old is it, is it a clone\n💬 Telegram – is this account suspicious\n⛓ Wallet – balance, transaction history, activity\n🛡️ Blacklists – sanctions, known scammers, seized wallets\n🔓 Token access – who can spend your money\n\n<b>Commands:</b>\n/watch <code>address</code> – monitor 24/7, alert on changes\n/watchlist – your monitoring list\n/approvals <code>0x... or T...</code> – check token access\n/lang – change language\n\n@roko_help · roko.help\nIdeas? Bugs? → welc@roko.help`,
    ru: `🦝 <b>Roko</b> – отправь ссылку, Telegram-имя или адрес кошелька.\n\n<b>Что проверяю:</b>\n🌐 Сайт – настоящий ли, сколько ему лет, не подделка ли\n💬 Телеграм – подозрительный ли аккаунт\n⛓ Кошелёк – баланс, история переводов, активность\n🛡️ Чёрные списки – санкции, известные мошенники, арестованные кошельки\n🔓 Доступ к токенам – кто может тратить твои деньги\n\n<b>Команды:</b>\n/watch <code>адрес</code> – следить 24/7, предупредить об изменениях\n/watchlist – твой список мониторинга\n/approvals <code>0x... или T...</code> – проверить доступ к токенам\n/lang – сменить язык\n\n@roko_help · roko.help\nИдеи? Баги? → welc@roko.help`,
    es: `🦝 <b>Roko</b> – envía un enlace, nombre de Telegram o dirección de wallet.\n\n<b>Qué verifico:</b>\n🌐 Sitio – es real, cuántos años tiene, es una copia\n💬 Telegram – es sospechosa esta cuenta\n⛓ Wallet – balance, historial de transacciones, actividad\n🛡️ Listas negras – sanciones, estafadores conocidos, wallets incautadas\n🔓 Acceso a tokens – quién puede gastar tu dinero\n\n<b>Comandos:</b>\n/watch <code>dirección</code> – monitorear 24/7, alertar ante cambios\n/watchlist – tu lista de monitoreo\n/approvals <code>0x... o T...</code> – verificar acceso a tokens\n/lang – cambiar idioma\n\n@roko_help · roko.help\n¿Ideas? ¿Bugs? → welc@roko.help`,
  },
  checking_addr: { en: '🔍 Checking %s address...', ru: '🔍 Проверяю %s адрес...', es: '🔍 Verificando dirección %s...' },
  checking_domain: { en: '🔍 Checking <b>%s</b>...', ru: '🔍 Проверяю <b>%s</b>...', es: '🔍 Verificando <b>%s</b>...' },
  checking_handle: { en: '🔍 Checking <b>@%s</b>...', ru: '🔍 Проверяю <b>@%s</b>...', es: '🔍 Verificando <b>@%s</b>...' },
  trust: { en: 'Trust', ru: 'Доверие', es: 'Confianza' },
  watch_cmd: { en: '📡 /watch <code>%s</code> – monitor', ru: '📡 /watch <code>%s</code> – следить', es: '📡 /watch <code>%s</code> – monitorear' },
  score_hi: { en: 'Low risk', ru: 'Низкий риск', es: 'Riesgo bajo' },
  score_mid: { en: 'Medium risk', ru: 'Средний риск', es: 'Riesgo medio' },
  score_lo: { en: 'High risk', ru: 'Высокий риск', es: 'Riesgo alto' },
  score_tg_hi: { en: 'Looks OK', ru: 'Похоже на норм', es: 'Parece OK' },
  score_tg_mid: { en: 'Be careful', ru: 'Осторожно', es: 'Con cuidado' },
  score_tg_lo: { en: 'High risk', ru: 'Высокий риск', es: 'Riesgo alto' },
  addr_fail: { en: `🦝 Can't determine address type.`, ru: `🦝 Не удалось определить тип адреса.`, es: `🦝 No puedo determinar el tipo de dirección.` },
  error: { en: 'Error: %s. Try again.', ru: 'Ошибка: %s. Попробуй ещё раз.', es: 'Error: %s. Inténtalo de nuevo.' },
  watch_use: { en: 'Use: /watch <code>address or domain</code>', ru: 'Используй: /watch <code>адрес или домен</code>', es: 'Usa: /watch <code>dirección o dominio</code>' },
  watch_unrecognized: { en: `🦝 Can't recognize – send a wallet address or domain.`, ru: `🦝 Не могу распознать – отправь адрес кошелька или домен.`, es: `🦝 No reconozco – envía una dirección o dominio.` },
  watch_added: { en: `📡 <b>Watching:</b> <code>%s</code>\nChecking every 30 min. I'll alert you if anything changes.\nRemove: /unwatch <code>%s</code>`, ru: `📡 <b>Слежу:</b> <code>%s</code>\nПроверяю каждые 30 мин. Напишу, если что-то изменится.\nУбрать: /unwatch <code>%s</code>`, es: `📡 <b>Vigilando:</b> <code>%s</code>\nVerificando cada 30 min. Te avisaré si algo cambia.\nQuitar: /unwatch <code>%s</code>` },
  watch_exists: { en: 'Already in your list.', ru: 'Уже в списке.', es: 'Ya está en tu lista.' },
  watch_limit: { en: 'Limit is 10. Remove something first: /unwatch', ru: 'Лимит – 10. Сначала удали что-нибудь: /unwatch', es: 'Límite: 10. Primero quita algo: /unwatch' },
  unwatch_ok: { en: '✅ Removed %s', ru: '✅ Убрал %s', es: '✅ Quitado %s' },
  unwatch_fail: { en: 'Not in your list.', ru: 'Этого нет в твоём списке.', es: 'No está en tu lista.' },
  watchlist_empty: { en: '📡 Empty list. Add: /watch <code>address or domain</code>', ru: '📡 Список пуст. Добавь: /watch <code>адрес или домен</code>', es: '📡 Lista vacía. Agrega: /watch <code>dirección o dominio</code>' },
  watchlist_title: { en: '📡 <b>Monitoring</b> (%s/10)', ru: '📡 <b>Мониторинг</b> (%s/10)', es: '📡 <b>Monitoreo</b> (%s/10)' },
  watchlist_remove: { en: 'Remove: /unwatch <code>...</code>', ru: 'Удалить: /unwatch <code>...</code>', es: 'Quitar: /unwatch <code>...</code>' },
  approvals_only: { en: '🦝 Approvals – ETH and TRON only.\nSend: /approvals <code>0x... or T...</code>', ru: '🦝 Approvals – только ETH и TRON.\nОтправь: /approvals <code>0x... или T...</code>', es: '🦝 Approvals – solo ETH y TRON.\nEnvía: /approvals <code>0x... o T...</code>' },
  approvals_scanning: { en: '🔍 Scanning approvals...', ru: '🔍 Сканирую approvals...', es: '🔍 Escaneando approvals...' },
  fallback: { en: `🦝 Send me a link, Telegram name, or wallet address – I'll check if it's safe.\n\nExamples:\n• <code>bestchange.com</code>\n• <code>@crypto_dealer</code>\n• BTC / ETH / TRON address\n\n/help – all commands`, ru: `🦝 Отправь мне ссылку, Telegram-имя или адрес кошелька – проверю, можно ли доверять.\n\nПримеры:\n• <code>bestchange.com</code>\n• <code>@crypto_dealer</code>\n• BTC / ETH / TRON адрес\n\n/help – все команды`, es: `🦝 Envíame un enlace, nombre de Telegram o dirección de wallet – verificaré si es seguro.\n\nEjemplos:\n• <code>bestchange.com</code>\n• <code>@crypto_dealer</code>\n• dirección BTC / ETH / TRON\n\n/help – todos los comandos` },
  lang_set: { en: '🌐 Language set to English', ru: '🌐 Язык: Русский', es: '🌐 Idioma: Español' },
  lang_choose: { en: 'Choose language:', ru: 'Выбери язык:', es: 'Elige idioma:' },
  guide_offline_bad: { en: '⛔ Better not meet this person', ru: '⛔ Лучше не встречайся с этим человеком', es: '⛔ Mejor no te reúnas con esta persona' },
  guide_offline: {
    en: ['📍 Public places with cameras only', '💵 Start with a small amount', '📱 Share your location with someone'],
    ru: ['📍 Только публичные места с камерами', '💵 Начни с маленькой суммы', '📱 Скинь геолокацию кому-то из своих'],
    es: ['📍 Solo lugares públicos con cámaras', '💵 Empieza con poco', '📱 Comparte tu ubicación con alguien'],
  },
  guide_wallet: { en: '🔓 Revoke unknown approvals → revoke.cash', ru: '🔓 Отзови незнакомые approvals → revoke.cash', es: '🔓 Revoca approvals desconocidos → revoke.cash' },
  guide_wallet_bad: { en: '⛔ This address has AML issues – don\'t send', ru: '⛔ У этого адреса проблемы с AML – не отправляй', es: '⛔ Esta dirección tiene problemas AML – no envíes' },
  guide_hi: { en: '✅ Looks OK. Split amounts >$1K into 2 transfers', ru: '✅ Выглядит ок. Суммы >$1K лучше разбить на 2 перевода', es: '✅ Parece OK. Divide montos >$1K en 2 envíos' },
  guide_mid: { en: ['⚠️ Send minimum first – wait for payout', '📸 Screenshot the conversation before sending'], ru: ['⚠️ Сначала отправь минимум – дождись выплаты', '📸 Сохрани скрины переписки до перевода'], es: ['⚠️ Envía el mínimo primero – espera el pago', '📸 Captura la conversación antes de enviar'] },
  guide_lo: { en: ['⛔ Roko does not recommend this exchanger', '📢 Have proof of scam? → @roko_help'], ru: ['⛔ Roko не рекомендует этот обменник', '📢 Есть доказательства скама? → @roko_help'], es: ['⛔ Roko no recomienda este exchanger', '📢 ¿Tienes pruebas de estafa? → @roko_help'] },
  monitor_dns_down: { en: '🚨 <b>%s</b> – site is down!\nPossibly shut down or seized. Don\'t send money.', ru: '🚨 <b>%s</b> – сайт не отвечает!\nВозможно, закрыт или изъят. Не отправляй деньги.', es: '🚨 <b>%s</b> – ¡sitio caído!\nPosiblemente cerrado o incautado. No envíes dinero.' },
  monitor_dns_up: { en: '🟢 <b>%s</b> – site is back online.', ru: '🟢 <b>%s</b> – сайт снова онлайн.', es: '🟢 <b>%s</b> – el sitio volvió.' },
  monitor_sanctioned: { en: '🚨 <b>Sanctioned!</b> Address <code>%s</code> is now on a sanctions list.\nDo not send funds.', ru: '🚨 <b>Санкции!</b> Адрес <code>%s</code> попал в санкционный список.\nНе отправляй на него средства.', es: '🚨 <b>¡Sancionado!</b> Dirección <code>%s</code> está en lista de sanciones.\nNo envíes fondos.' },
  exchange_cta: { en: '\n💬 Not sure where to exchange safely? welc@roko.help', ru: '\n💬 Не знаешь, где безопасно обменять? welc@roko.help', es: '\n💬 ¿No sabes dónde cambiar de forma segura? welc@roko.help' },
  roko_hi: { en: '🦝 Looks clean. I dug through everything – no red flags.', ru: '🦝 Чисто. Я всё перерыл – ничего подозрительного.', es: '🦝 Limpio. Busqué por todos lados – sin banderas rojas.' },
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

// Persistence override for Cloud Functions (Firestore)
function overrideLangs(newLangs, newSave) {
  if (newLangs) userLangs = newLangs;
  if (newSave) saveLangs = newSave;
}

function getUserLangs() { return userLangs; }

module.exports = { I, t, getLang, setLang, overrideLangs, getUserLangs };
