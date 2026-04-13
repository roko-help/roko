// Telegram API helpers – tg(), send(), esc()
const https = require('https');
const { API } = require('./config');

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

module.exports = { tg, send, esc };
