// Load JSON data files, build lookup objects, phishing detection
const { readFileSync } = require('fs');
const { resolve } = require('path');

const DATA_DIR = resolve(__dirname, '..', '..', 'data');

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

// OFAC sanctioned crypto addresses
const SANCTIONED_ADDRESSES = new Set([
  ...(ofacData?.addresses || []).map(a => a.toLowerCase()),
  // Hardcoded fallback
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

// Known mixer/high-risk labels
const KNOWN_MIXER_ADDRESSES = new Set([
  '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b',
  '0x722122df12d4e14e13ac3b6895a86e84145b6967',
]);

// Phishing detection (Levenshtein distance)
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
  const dl = domain.toLowerCase().replace(/\.[^.]+$/, '');
  const results = [];

  for (const target of PHISHING_TARGETS) {
    if (dl === target) continue;

    const dist = levenshtein(dl, target);
    if (dist > 0 && dist <= 2) {
      results.push({ target: target, type: 'typosquat', distance: dist });
      continue;
    }

    if (dl.length > target.length && dl.includes(target)) {
      results.push({ target: target, type: 'substring' });
      continue;
    }

    const brandClean = target.replace(/[^a-z0-9]/g, '');
    const domainClean = dl.replace(/[^a-z0-9]/g, '');
    if (domainClean.length > brandClean.length && domainClean.includes(brandClean)) {
      results.push({ target: target, type: 'contains-brand' });
    }
  }

  return results;
}

// Address type detection
function detectAddressType(addr) {
  addr = addr.trim();
  if (/^(bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(addr)) return 'btc';
  if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(addr)) return 'btc';
  if (/^0x[a-fA-F0-9]{40}$/.test(addr)) return 'eth';
  if (/^T[a-zA-Z0-9]{33}$/.test(addr)) return 'tron';
  return null;
}

module.exports = {
  safeDomainsData,
  KNOWN_SCAM, KNOWN_GOOD, KNOWN_WARN,
  PHISHING_TARGETS, SANCTIONED_ADDRESSES, KNOWN_MIXER_ADDRESSES,
  checkPhishing, levenshtein, detectAddressType,
};
