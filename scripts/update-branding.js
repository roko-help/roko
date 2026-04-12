/**
 * Update Telegram bot profile + channel description + pinned message
 * Run once: node scripts/update-branding.js
 */

const https = require('https');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const ENV_PATH = resolve(__dirname, '../../LLM/.env');
let TOKEN = process.env.ROKO_TELEGRAM_TOKEN;
if (!TOKEN) {
  try {
    const env = readFileSync(ENV_PATH, 'utf8');
    const m = env.match(/^ROKO_TELEGRAM_TOKEN=(.+)$/m);
    if (m) TOKEN = m[1].trim();
  } catch {}
}
if (!TOKEN) { console.error('No ROKO_TELEGRAM_TOKEN'); process.exit(1); }

const API = `https://api.telegram.org/bot${TOKEN}`;

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

async function run() {
  console.log('Updating bot branding...\n');
  let r;

  // ===== BOT DESCRIPTION (before /start – for a normal person) =====
  const descRu = [
    'Хочешь обменять крипту, но не уверен в обменнике?',
    '',
    'Отправь ссылку на сайт, Telegram-аккаунт или адрес кошелька – Roko проверит по базам мошенников, чёрным спискам и санкциям.',
    '',
    'Ответ за 3 секунды. Бесплатно.',
  ].join('\n');

  const descEn = [
    'Want to exchange crypto but not sure about the exchanger?',
    '',
    'Send a website link, Telegram account, or wallet address – Roko checks scam databases, blacklists, and sanctions.',
    '',
    'Answer in 3 seconds. Free.',
  ].join('\n');

  const descEs = [
    '¿Quieres cambiar crypto pero no confías en el exchanger?',
    '',
    'Envía un enlace, cuenta de Telegram o dirección de wallet – Roko verifica bases de estafadores, listas negras y sanciones.',
    '',
    'Respuesta en 3 segundos. Gratis.',
  ].join('\n');

  r = await tg('setMyDescription', { description: descRu, language_code: 'ru' });
  console.log('description ru:', r.ok ? '✅' : '❌');
  r = await tg('setMyDescription', { description: descEn, language_code: 'en' });
  console.log('description en:', r.ok ? '✅' : '❌');
  r = await tg('setMyDescription', { description: descEs, language_code: 'es' });
  console.log('description es:', r.ok ? '✅' : '❌');
  r = await tg('setMyDescription', { description: descEn });
  console.log('description default:', r.ok ? '✅' : '❌');

  // ===== SHORT DESCRIPTION =====
  r = await tg('setMyShortDescription', { short_description: 'Проверь обменник перед отправкой крипты – roko.help', language_code: 'ru' });
  console.log('short ru:', r.ok ? '✅' : '❌');
  r = await tg('setMyShortDescription', { short_description: 'Check the exchanger before you send crypto – roko.help', language_code: 'en' });
  console.log('short en:', r.ok ? '✅' : '❌');
  r = await tg('setMyShortDescription', { short_description: 'Verifica el exchanger antes de enviar crypto – roko.help', language_code: 'es' });
  console.log('short es:', r.ok ? '✅' : '❌');
  r = await tg('setMyShortDescription', { short_description: 'Check the exchanger before you send crypto – roko.help' });
  console.log('short default:', r.ok ? '✅' : '❌');

  // ===== NAME =====
  for (const lc of ['ru', 'en', 'es', undefined]) {
    const body = { name: 'Roko' };
    if (lc) body.language_code = lc;
    r = await tg('setMyName', body);
    console.log(`name ${lc || 'default'}:`, r.ok ? '✅' : '❌');
  }

  // ===== COMMANDS =====
  const cmdsRu = [
    { command: 'start', description: 'Начать' },
    { command: 'help', description: 'Как работает' },
    { command: 'watch', description: 'Следить за адресом или доменом 24/7' },
    { command: 'watchlist', description: 'Список мониторинга' },
    { command: 'unwatch', description: 'Перестать следить' },
    { command: 'approvals', description: 'Проверить доступ к токенам (ETH/TRON)' },
    { command: 'lang', description: 'Сменить язык' },
  ];
  const cmdsEn = [
    { command: 'start', description: 'Start' },
    { command: 'help', description: 'How it works' },
    { command: 'watch', description: 'Monitor address or domain 24/7' },
    { command: 'watchlist', description: 'Monitoring list' },
    { command: 'unwatch', description: 'Stop monitoring' },
    { command: 'approvals', description: 'Check token access (ETH/TRON)' },
    { command: 'lang', description: 'Change language' },
  ];
  const cmdsEs = [
    { command: 'start', description: 'Iniciar' },
    { command: 'help', description: 'Cómo funciona' },
    { command: 'watch', description: 'Monitorear dirección o dominio 24/7' },
    { command: 'watchlist', description: 'Lista de monitoreo' },
    { command: 'unwatch', description: 'Dejar de monitorear' },
    { command: 'approvals', description: 'Verificar acceso a tokens (ETH/TRON)' },
    { command: 'lang', description: 'Cambiar idioma' },
  ];
  r = await tg('setMyCommands', { commands: cmdsRu, language_code: 'ru' });
  console.log('commands ru:', r.ok ? '✅' : '❌');
  r = await tg('setMyCommands', { commands: cmdsEn, language_code: 'en' });
  console.log('commands en:', r.ok ? '✅' : '❌');
  r = await tg('setMyCommands', { commands: cmdsEs, language_code: 'es' });
  console.log('commands es:', r.ok ? '✅' : '❌');
  r = await tg('setMyCommands', { commands: cmdsEn });
  console.log('commands default:', r.ok ? '✅' : '❌');

  // ===== CHANNEL DESCRIPTION =====
  const chDesc = [
    'Как не потерять деньги при обмене крипты.',
    'Разбираем реальные схемы мошенничества, предупреждаем о новых.',
    '',
    '@RokoHelpBot · roko.help · welc@roko.help',
  ].join('\n');
  r = await tg('setChatDescription', { chat_id: '@roko_help', description: chDesc });
  console.log('channel description:', r.ok ? '✅' : '❌');

  // ===== PINNED MESSAGE =====
  const pin = [
    '🦝 <b>Roko</b> – проверь обменник перед отправкой крипты',
    '',
    'Не уверен в сайте или продавце? Отправь ссылку в бот – Roko проверит по базам мошенников и скажет, можно доверять или нет. Бесплатно.',
    '',
    '🇬🇧 Not sure about a crypto exchanger? Send the link to the bot – Roko checks scam databases and tells you if it\'s safe. Free.',
    '',
    '🇪🇸 ¿No confías en un exchanger? Envía el enlace al bot – Roko verifica y te dice si es seguro. Gratis.',
    '',
    '🤖 @RokoHelpBot',
    '🌐 roko.help',
    '💬 welc@roko.help',
  ].join('\n');

  r = await tg('sendMessage', { chat_id: '@roko_help', text: pin, parse_mode: 'HTML', disable_web_page_preview: true });
  if (r.ok) {
    console.log('pinned msg:', '✅', 'id:', r.result.message_id);
    const p = await tg('pinChatMessage', { chat_id: '@roko_help', message_id: r.result.message_id, disable_notification: true });
    console.log('pinned:', p.ok ? '✅' : '❌');
  } else {
    console.log('send:', '❌', JSON.stringify(r));
  }

  console.log('\nDone.');
}

run().catch(e => { console.error(e); process.exit(1); });
