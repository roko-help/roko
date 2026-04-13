// TRON address check via TronGrid API
const crypto = require('crypto');
const { fetchJSON } = require('../http');
const { esc } = require('../telegram');
const { USDT_TRC20 } = require('../config');
const { SANCTIONED_ADDRESSES } = require('../data');

// Convert TRON hex address (41...) to base58check
const B58_ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function hexToBase58(hex) {
  if (!hex || !hex.startsWith('41') || hex.length !== 42) return null;
  const buf = Buffer.from(hex, 'hex');
  const h1 = crypto.createHash('sha256').update(buf).digest();
  const h2 = crypto.createHash('sha256').update(h1).digest();
  const payload = Buffer.concat([buf, h2.slice(0, 4)]);
  let num = BigInt('0x' + payload.toString('hex'));
  let result = '';
  while (num > 0n) { result = B58_ALPHA[Number(num % 58n)] + result; num /= 58n; }
  for (const b of payload) { if (b === 0) result = '1' + result; else break; }
  return result;
}

async function checkTRON(address) {
  const results = [];
  let score = 40;

  if (SANCTIONED_ADDRESSES.has(address)) {
    results.push(`🔴 <b>OFAC SANCTIONED ADDRESS</b> – do NOT transact`);
    return { score: 0, results, chain: 'TRON' };
  }

  try {
    const data = await fetchJSON(`https://api.trongrid.io/v1/accounts/${address}`);

    if (!data?.data || data.data.length === 0) {
      results.push(`⚪ Address not found on TRON – may be unused`);
      return { score: 20, results, chain: 'TRON' };
    }

    const info = data.data[0];
    const balanceTRX = (info.balance || 0) / 1e6;
    const createTime = info.create_time;

    results.push(`💰 Balance: <b>${balanceTRX.toFixed(2)} TRX</b> (~$${(balanceTRX * 0.25).toFixed(2)})`);

    const trc20 = info.trc20 || [];
    const usdtEntry = trc20.find(t => t[USDT_TRC20] !== undefined);
    if (usdtEntry) {
      const usdtBalance = parseInt(usdtEntry[USDT_TRC20]) / 1e6;
      results.push(`💵 USDT (TRC-20): <b>${usdtBalance.toLocaleString()}</b>`);
      if (usdtBalance > 50000) { results.push(`🟢 Significant USDT holdings`); score += 10; }
      else if (usdtBalance > 1000) { score += 5; }
    } else {
      results.push(`💵 USDT (TRC-20): 0`);
    }

    if (createTime) {
      const created = new Date(createTime);
      const age = (Date.now() - created.getTime()) / (365.25 * 24 * 3600000);
      if (age >= 1) { results.push(`🟢 Account age: ${age.toFixed(1)} years`); score += 15; }
      else if (age >= 0.08) { results.push(`🟡 Account age: ${Math.round(age * 12)} months`); score += 5; }
      else { results.push(`🔴 Account age: ${Math.round(age * 365)} days – very new`); score -= 10; }
    }

    if (info.frozenV2 && info.frozenV2.some(f => f.amount > 0)) {
      results.push(`🟢 Has staked TRX – invested in network`);
      score += 5;
    }

    if (balanceTRX > 10000) score += 5;

    // Depth-1 AML: scan counterparties against OFAC
    try {
      const txData = await fetchJSON(`https://api.trongrid.io/v1/accounts/${address}/transactions?limit=50&only_confirmed=true`);
      const counterparties = new Set();
      for (const tx of (txData.data || [])) {
        const v = tx.raw_data?.contract?.[0]?.parameter?.value || {};
        if (v.owner_address) { const b58 = hexToBase58(v.owner_address); if (b58 && b58 !== address) counterparties.add(b58); }
        if (v.to_address) { const b58 = hexToBase58(v.to_address); if (b58 && b58 !== address) counterparties.add(b58); }
      }
      let flagged = 0;
      for (const cp of counterparties) {
        if (SANCTIONED_ADDRESSES.has(cp) || SANCTIONED_ADDRESSES.has(cp.toLowerCase())) flagged++;
      }
      if (flagged > 0) {
        results.push(`🔴 <b>AML: ${flagged} counterparties in sanctions lists</b>`);
        score -= 20;
      } else if (counterparties.size > 0) {
        results.push(`🟢 AML: ${counterparties.size} counterparties checked – none sanctioned`);
        score += 5;
      }
    } catch { /* depth-1 scan failed silently */ }

  } catch (e) {
    results.push(`⚪ TRON check unavailable: ${esc(e.message)}`);
  }

  score = Math.max(0, Math.min(100, score));
  return { score, results, chain: 'TRON' };
}

module.exports = { checkTRON };
