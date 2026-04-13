// HTTP helpers – fetchJSON and fetchText with redirect following
const https = require('https');
const http = require('http');

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

module.exports = { fetchJSON, fetchText };
