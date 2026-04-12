#!/usr/bin/env node
/**
 * OFAC SDN List → ofac-addresses.json
 *
 * Downloads the OFAC Specially Designated Nationals (SDN) list
 * and extracts all cryptocurrency addresses (Digital Currency Addresses).
 *
 * Sources:
 *   - SDN Advanced XML: https://www.treasury.gov/ofac/downloads/sdn_advanced.xml
 *   - SDN CSV (fallback): https://www.treasury.gov/ofac/downloads/sdn.csv
 *
 * Usage:
 *   node scripts/update-ofac.js
 *
 * Output:
 *   data/ofac-addresses.json – array of { address, currency, entity, program }
 *
 * Automated via GitHub Actions: .github/workflows/update-ofac.yml (weekly)
 */

const https = require('https');
const { writeFileSync } = require('fs');
const { resolve } = require('path');

const SDN_CSV_URL = 'https://www.treasury.gov/ofac/downloads/sdn.csv';
const SDN_ADVANCED_URL = 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/ADVANCED_XML';
const OUTPUT = resolve(__dirname, '..', 'data', 'ofac-addresses.json');

function fetch(url) {
  return new Promise((res, rej) => {
    const request = (u) => {
      https.get(u, { headers: { 'User-Agent': 'RokoBot/1.0 (crypto-safety-checker)' } }, r => {
        // Follow redirects
        if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
          return request(r.headers.location);
        }
        if (r.statusCode !== 200) return rej(new Error(`HTTP ${r.statusCode}`));
        let b = '';
        r.on('data', d => b += d);
        r.on('end', () => res(b));
      }).on('error', rej);
    };
    request(url);
  });
}

// Parse XML for Digital Currency Address features
function parseXML(xml) {
  const addresses = [];
  // Match Feature entries with FeatureType "Digital Currency Address"
  const featureRegex = /<Feature[^>]*>[\s\S]*?<\/Feature>/gi;
  const features = xml.match(featureRegex) || [];

  for (const feature of features) {
    if (!feature.includes('Digital Currency Address')) continue;

    // Extract the address value
    const valueMatch = feature.match(/<VersionDetail[^>]*>([^<]+)<\/VersionDetail>/i)
                    || feature.match(/<Value[^>]*>([^<]+)<\/Value>/i);
    if (!valueMatch) continue;

    const address = valueMatch[1].trim();
    if (!address || address.length < 20) continue;

    // Try to find currency type
    let currency = 'unknown';
    if (address.startsWith('0x') && address.length === 42) currency = 'ETH';
    else if (address.startsWith('T') && address.length === 34) currency = 'TRON';
    else if (address.startsWith('bc1') || /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) currency = 'BTC';
    else if (address.startsWith('r') && address.length >= 25 && address.length <= 35) currency = 'XRP';
    else if (address.startsWith('t1') || address.startsWith('t3')) currency = 'ZEC';
    else if (address.startsWith('L') || address.startsWith('M') || address.startsWith('ltc1')) currency = 'LTC';
    else if (address.length >= 40 && address.length <= 50) currency = 'ETH'; // likely ERC-20

    addresses.push({ address, currency });
  }

  return addresses;
}

// Fallback: parse CSV for crypto addresses mentioned in remarks
function parseCSV(csv) {
  const addresses = [];
  const lines = csv.split('\n');

  // Crypto address patterns
  const patterns = [
    { re: /\b(0x[a-fA-F0-9]{40})\b/g, currency: 'ETH' },
    { re: /\b(T[a-zA-Z0-9]{33})\b/g, currency: 'TRON' },
    { re: /\b(bc1[a-zA-HJ-NP-Z0-9]{25,62})\b/g, currency: 'BTC' },
    { re: /\b([13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g, currency: 'BTC' },
    { re: /\b(L[a-km-zA-HJ-NP-Z1-9]{26,33})\b/g, currency: 'LTC' },
  ];

  for (const line of lines) {
    for (const { re, currency } of patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        const addr = m[1];
        if (!addresses.find(a => a.address.toLowerCase() === addr.toLowerCase())) {
          addresses.push({ address: addr, currency });
        }
      }
    }
  }

  return addresses;
}

async function main() {
  console.log('🦝 Roko OFAC SDN Updater\n');

  let addresses = [];

  // Try XML first (more structured)
  try {
    console.log('📥 Downloading SDN Advanced XML...');
    const xml = await fetch(SDN_ADVANCED_URL);
    addresses = parseXML(xml);
    console.log(`   Found ${addresses.length} addresses in XML`);
  } catch (e) {
    console.log(`   XML failed: ${e.message}`);
  }

  // Fallback to CSV
  if (addresses.length < 10) {
    try {
      console.log('📥 Downloading SDN CSV (fallback)...');
      const csv = await fetch(SDN_CSV_URL);
      const csvAddresses = parseCSV(csv);
      console.log(`   Found ${csvAddresses.length} addresses in CSV`);

      // Merge, deduplicate
      for (const a of csvAddresses) {
        if (!addresses.find(x => x.address.toLowerCase() === a.address.toLowerCase())) {
          addresses.push(a);
        }
      }
    } catch (e) {
      console.log(`   CSV failed: ${e.message}`);
    }
  }

  if (addresses.length === 0) {
    console.error('❌ No addresses found. Keeping existing file.');
    process.exit(1);
  }

  // Sort by currency, then address
  addresses.sort((a, b) => a.currency.localeCompare(b.currency) || a.address.localeCompare(b.address));

  // Write
  const output = {
    _meta: {
      source: 'US Treasury OFAC SDN List',
      url: 'https://www.treasury.gov/ofac/downloads/',
      updated: new Date().toISOString().slice(0, 10),
      count: addresses.length
    },
    addresses: addresses.map(a => a.address),
    detailed: addresses
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');
  console.log(`\n✅ Saved ${addresses.length} addresses to data/ofac-addresses.json`);
  console.log(`   BTC: ${addresses.filter(a => a.currency === 'BTC').length}`);
  console.log(`   ETH: ${addresses.filter(a => a.currency === 'ETH').length}`);
  console.log(`   TRON: ${addresses.filter(a => a.currency === 'TRON').length}`);
  console.log(`   Other: ${addresses.filter(a => !['BTC','ETH','TRON'].includes(a.currency)).length}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
