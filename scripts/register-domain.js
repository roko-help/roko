/**
 * Register roko.help domain via Porkbun API
 * Run once: node scripts/register-domain.js
 */

const https = require('https');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const ENV_PATH = resolve(__dirname, '../../LLM/.env');
const env = readFileSync(ENV_PATH, 'utf8');
const getKey = (name) => {
  const m = env.match(new RegExp(`^${name}=(.+)$`, 'm'));
  return m ? m[1].trim() : null;
};

const API_KEY = getKey('PORKBUN_API_KEY');
const SECRET_KEY = getKey('PORKBUN_SECRET_KEY');

if (!API_KEY || !SECRET_KEY) {
  console.error('Missing Porkbun API keys in', ENV_PATH);
  process.exit(1);
}

function porkbun(endpoint, extra = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ apikey: API_KEY, secretapikey: SECRET_KEY, ...extra });
    const req = https.request(`https://api.porkbun.com/api/json/v3/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch { resolve({ status: 'ERROR', raw: buf }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Checking availability of roko.help...');

  // Register
  console.log('Registering roko.help...');
  const result = await porkbun('domain/register/roko.help', {
    domain: 'roko.help',
    years: 1,
  });

  console.log('Result:', JSON.stringify(result, null, 2));

  if (result.status === 'SUCCESS') {
    console.log('\n✅ roko.help registered successfully!');
    console.log('Now configure DNS for Firebase Hosting.');
  } else {
    console.log('\n❌ Registration failed:', result.message || result.status);
  }
}

main().catch(err => console.error('Error:', err));
