/**
 * Update Telegram bot profile + channel description + pinned message
 * Run once: node scripts/update-branding.js
 */

const https = require('https');
const { readFileSync } = require('fs');
const { resolve } = require('path');

// --- Token ---
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

  // ===== BOT DESCRIPTION (before /start) =====
  const descRu = [
    'Скинули подозрительную ссылку? Вставь сюда.',
    '',
    'Roko проверит домен, кошелёк или Telegram-аккаунт за 3 секунды – и скажет, безопасно или скам.',
    '',
    '🌐 Сайт – домен, возраст, SSL, контент',
    '⛓ Кошелёк – баланс, история, USDT',
    '🛡️ Санкции – OFAC, миксеры, скам-базы',
    '🔓 Approvals – кто может тратить твои токены',
    '📡 Мониторинг 24/7',
    '',
    'Бесплатно. Открытый код.',
  ].join('\n');

  const descEn = [
    'Got a sketchy link? Paste it here.',
    '',
    'Roko checks domains, wallets, and Telegram accounts in 3 seconds – and tells you if it\'s safe or a scam.',
    '',
    '🌐 Website – domain, age, SSL, content',
    '⛓ Wallet – balance, history, USDT',
    '🛡️ Sanctions – OFAC, mixers, scam databases',
    '🔓 Approvals – who can spend your tokens',
    '📡 24/7 monitoring',
    '',
    'Free. Open source.',
  ].join('\n');

  const descEs = [
    '¿Te enviaron un enlace sospechoso? Pégalo aquí.',
    '',
    'Roko verifica dominios, wallets y cuentas de Telegram en 3 segundos – y te dice si es seguro o estafa.',
    '',
    '🌐 Sitio – dominio, antigüedad, SSL, contenido',
    '⛓ Wallet – balance, historial, USDT',
    '🛡️ Sanciones – OFAC, mixers, bases de scam',
    '🔓 Approvals – quién puede gastar tus tokens',
    '📡 Monitoreo 24/7',
    '',
    'Gratis. Código abierto.',
  ].join('\n');

  r = await tg('setMyDescription', { description: descRu, language_code: 'ru' });
  console.log('description ru:', r.ok ? '✅' : '❌');
  r = await tg('setMyDescription', { description: descEn, language_code: 'en' });
  console.log('description en:', r.ok ? '✅' : '❌');
  r = await tg('setMyDescription', { description: descEs, language_code: 'es' });
  console.log('description es:', r.ok ? '✅' : '❌');
  r = await tg('setMyDescription', { description: descEn });
  console.log('description default:', r.ok ? '✅' : '❌');

  // ===== SHORT DESCRIPTION (profile card) =====
  r = await tg('setMyShortDescription', { short_description: 'Проверь перед отправкой – roko.help', language_code: 'ru' });
  console.log('short ru:', r.ok ? '✅' : '❌');
  r = await tg('setMyShortDescription', { short_description: 'Check before you send – roko.help', language_code: 'en' });
  console.log('short en:', r.ok ? '✅' : '❌');
  r = await tg('setMyShortDescription', { short_description: 'Verifica antes de enviar – roko.help', language_code: 'es' });
  console.log('short es:', r.ok ? '✅' : '❌');
  r = await tg('setMyShortDescription', { short_description: 'Check before you send – roko.help' });
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
    { command: 'approvals', description: 'Скан approvals (ETH/TRON)' },
    { command: 'lang', description: 'Сменить язык' },
  ];
  const cmdsEn = [
    { command: 'start', description: 'Start' },
    { command: 'help', description: 'How it works' },
    { command: 'watch', description: 'Monitor address or domain 24/7' },
    { command: 'watchlist', description: 'Monitoring list' },
    { command: 'unwatch', description: 'Stop monitoring' },
    { command: 'approvals', description: 'Scan token approvals (ETH/TRON)' },
    { command: 'lang', description: 'Change language' },
  ];
  const cmdsEs = [
    { command: 'start', description: 'Iniciar' },
    { command: 'help', description: 'Cómo funciona' },
    { command: 'watch', description: 'Monitorear dirección o dominio 24/7' },
    { command: 'watchlist', description: 'Lista de monitoreo' },
    { command: 'unwatch', description: 'Dejar de monitorear' },
    { command: 'approvals', description: 'Escanear approvals (ETH/TRON)' },
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
    'Скам-алерты · новые схемы · обновления Roko',
    'Scam alerts · new schemes · Roko updates',
    'Alertas de estafa · nuevos esquemas · actualizaciones',
    '',
    '@RokoHelpBot · roko.help · welc@roko.help',
  ].join('\n');
  r = await tg('setChatDescription', { chat_id: '@roko_help', description: chDesc });
  console.log('channel description:', r.ok ? '✅' : '❌');

  // ===== PINNED MESSAGE – links once at bottom =====
  const pin = [
    '🦝 <b>Roko</b> – проверь перед отправкой',
    '',
    'Скинули подозрительную ссылку? Вставь в бот.',
    'Домен, санкции, блокчейн, approvals – 3 секунды.',
    '',
    '🇬🇧 <b>Roko</b> – check before you send',
    '',
    'Got a sketchy link? Paste it in the bot.',
    'Domain, sanctions, blockchain, approvals – 3 seconds.',
    '',
    '🇪🇸 <b>Roko</b> – verifica antes de enviar',
    '',
    '¿Enlace sospechoso? Pégalo en el bot.',
    'Dominio, sanciones, blockchain, approvals – 3 segundos.',
    '',
    '🤖 @RokoHelpBot',
    '🌐 roko.help',
    '💬 welc@roko.help',
  ].join('\n');

  r = await tg('sendMessage', { chat_id: '@roko_help', text: pin, parse_mode: 'HTML', disable_web_page_preview: true });
  if (r.ok) {
    console.log('pinned msg sent:', '✅', 'id:', r.result.message_id);
    const p = await tg('pinChatMessage', { chat_id: '@roko_help', message_id: r.result.message_id, disable_notification: true });
    console.log('pinned:', p.ok ? '✅' : '❌');
  } else {
    console.log('send:', '❌', JSON.stringify(r));
  }

  console.log('\nDone.');
}

run().catch(e => { console.error(e); process.exit(1); });
