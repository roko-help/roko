// Bitcoin address check via mempool.space API
const { fetchJSON } = require('../http');
const { esc } = require('../telegram');
const { SANCTIONED_ADDRESSES } = require('../data');

async function checkBTC(address) {
  const results = [];
  let score = 40;

  if (SANCTIONED_ADDRESSES.has(address.toLowerCase()) || SANCTIONED_ADDRESSES.has(address)) {
    results.push(`🔴 <b>OFAC SANCTIONED ADDRESS</b> – do NOT transact`);
    return { score: 0, results, chain: 'BTC' };
  }

  try {
    const data = await fetchJSON(`https://mempool.space/api/address/${address}`);
    const stats = data.chain_stats || {};
    const funded = stats.funded_txo_sum || 0;
    const spent = stats.spent_txo_sum || 0;
    const balance = (funded - spent) / 1e8;
    const txCount = stats.tx_count || 0;
    const totalReceived = funded / 1e8;

    results.push(`💰 Balance: <b>${balance.toFixed(8)} BTC</b> (~$${(balance * 85000).toFixed(0)})`);
    results.push(`📊 Transactions: ${txCount} total, received ${totalReceived.toFixed(4)} BTC`);

    if (txCount > 1000) {
      results.push(`🟢 High activity address (${txCount} txs) – likely operational`);
      score += 15;
    } else if (txCount > 50) {
      results.push(`🟢 Moderate activity (${txCount} txs)`);
      score += 10;
    } else if (txCount > 5) {
      score += 5;
    } else if (txCount < 3) {
      results.push(`🟡 Very low activity (${txCount} txs) – new or one-time address`);
      score -= 5;
    }

    if (txCount <= 2 && balance === 0 && totalReceived > 0) {
      results.push(`🟡 Funds received and immediately moved out – sweep pattern`);
      score -= 5;
    }

    if (balance > 1) { score += 5; }
    if (balance > 10) { score += 5; }

    // Depth-1 AML: scan counterparties against OFAC
    try {
      const txs = await fetchJSON(`https://mempool.space/api/address/${address}/txs`);
      const counterparties = new Set();
      for (const tx of (txs || []).slice(0, 25)) {
        for (const vi of (tx.vin || [])) {
          if (vi.prevout?.scriptpubkey_address && vi.prevout.scriptpubkey_address !== address)
            counterparties.add(vi.prevout.scriptpubkey_address);
        }
        for (const vo of (tx.vout || [])) {
          if (vo.scriptpubkey_address && vo.scriptpubkey_address !== address)
            counterparties.add(vo.scriptpubkey_address);
        }
      }
      let flagged = 0;
      for (const cp of counterparties) {
        if (SANCTIONED_ADDRESSES.has(cp.toLowerCase()) || SANCTIONED_ADDRESSES.has(cp)) flagged++;
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
    results.push(`⚪ BTC check unavailable: ${esc(e.message)}`);
  }

  score = Math.max(0, Math.min(100, score));
  return { score, results, chain: 'BTC' };
}

module.exports = { checkBTC };
