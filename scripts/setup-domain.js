/**
 * Setup roko.help domain — register + configure DNS for Firebase Hosting
 *
 * Prerequisites:
 * 1. Verify phone + email at porkbun.com/account
 * 2. Add credit ($10 min) at porkbun.com/account (Settings > Billing > Pre-fund)
 * 3. Run: node scripts/setup-domain.js
 *
 * After running this script:
 * 4. Add custom domain in Firebase Console:
 *    https://console.firebase.google.com/project/roko-help/hosting/sites
 *    Add "roko.help" → Firebase gives TXT verification record
 * 5. Run: node scripts/setup-domain.js verify <txt-value>
 * 6. Firebase will issue SSL cert automatically (may take up to 24h)
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
const DOMAIN = 'roko.help';

// Firebase Hosting IP addresses
const FIREBASE_IPS = ['151.101.1.195', '151.101.65.195'];

function porkbun(endpoint, extra = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ apikey: API_KEY, secretapikey: SECRET_KEY, ...extra });
    const url = `https://api.porkbun.com/api/json/v3/${endpoint}`;
    const req = https.request(url, {
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

async function registerDomain() {
  console.log(`Registering ${DOMAIN}...`);
  const result = await porkbun(`domain/create/${DOMAIN}`, {
    cost: 154, // $1.54 in pennies
    agreeToTerms: 'yes',
  });

  if (result.status === 'SUCCESS') {
    console.log(`✅ ${DOMAIN} registered!`);
    console.log(`   Order ID: ${result.orderId}`);
    console.log(`   Balance: $${(result.balance / 100).toFixed(2)}`);
    return true;
  } else {
    console.error(`❌ Registration failed: ${result.message}`);
    return false;
  }
}

async function setupDNS(txtValue) {
  console.log(`\nConfiguring DNS for ${DOMAIN}...`);

  // Delete existing A records
  const existing = await porkbun(`dns/retrieve/${DOMAIN}`);
  if (existing.status === 'SUCCESS' && existing.records) {
    for (const rec of existing.records) {
      if (rec.type === 'A' && rec.name === DOMAIN) {
        await porkbun(`dns/delete/${DOMAIN}/${rec.id}`);
        console.log(`  Deleted old A record: ${rec.content}`);
      }
    }
  }

  // Add Firebase A records
  for (const ip of FIREBASE_IPS) {
    const res = await porkbun(`dns/create/${DOMAIN}`, {
      type: 'A',
      name: '',
      content: ip,
      ttl: 600,
    });
    console.log(`  A record ${ip}: ${res.status}`);
  }

  // Add www CNAME
  const cname = await porkbun(`dns/create/${DOMAIN}`, {
    type: 'CNAME',
    name: 'www',
    content: 'roko-help.web.app',
    ttl: 600,
  });
  console.log(`  CNAME www → roko-help.web.app: ${cname.status}`);

  // Add TXT for Firebase verification if provided
  if (txtValue) {
    const txt = await porkbun(`dns/create/${DOMAIN}`, {
      type: 'TXT',
      name: '',
      content: txtValue,
      ttl: 600,
    });
    console.log(`  TXT verification: ${txt.status}`);
  }

  console.log('\n✅ DNS configured!');
  console.log('Next: add roko.help as custom domain in Firebase Console');
  console.log('https://console.firebase.google.com/project/roko-help/hosting/sites');
}

async function main() {
  const cmd = process.argv[2];

  if (cmd === 'dns') {
    const txtValue = process.argv[3];
    await setupDNS(txtValue);
  } else if (cmd === 'verify') {
    const txtValue = process.argv[3];
    if (!txtValue) {
      console.error('Usage: node scripts/setup-domain.js verify <txt-value>');
      process.exit(1);
    }
    // Just add TXT record
    const txt = await porkbun(`dns/create/${DOMAIN}`, {
      type: 'TXT',
      name: '',
      content: txtValue,
      ttl: 600,
    });
    console.log(`TXT record added: ${txt.status}`);
  } else {
    // Full flow: register + DNS
    const registered = await registerDomain();
    if (registered) {
      await setupDNS();
    }
  }
}

main().catch(err => console.error('Error:', err));
