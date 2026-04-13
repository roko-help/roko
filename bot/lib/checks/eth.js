// Ethereum address check via LlamaRPC (free public RPC)
const https = require('https');
const { USDT_ERC20 } = require('../config');
const { SANCTIONED_ADDRESSES, KNOWN_MIXER_ADDRESSES } = require('../data');

function ethRpcCallOnce(method, params) {
  return new Promise((res, rej) => {
    const postData = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const req = https.request('https://eth.llamarpc.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
      timeout: 10000,
    }, r => {
      let b = '';
      r.on('data', d => b += d);
      r.on('end', () => { try { const j = JSON.parse(b); res(j); } catch { rej(new Error('parse')); } });
    });
    req.on('error', rej);
    req.on('timeout', () => { req.destroy(); rej(new Error('timeout')); });
    req.write(postData);
    req.end();
  });
}

async function ethRpcCall(method, params, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await ethRpcCallOnce(method, params);
      if (r.result !== undefined) return r;
      if (i < retries) await new Promise(ok => setTimeout(ok, 500));
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(ok => setTimeout(ok, 500));
    }
  }
  return {};
}

async function checkETH(address) {
  const results = [];
  let score = 40;
  const addrLower = address.toLowerCase();

  if (SANCTIONED_ADDRESSES.has(addrLower)) {
    results.push(`🔴 <b>OFAC SANCTIONED ADDRESS</b> – do NOT transact`);
    return { score: 0, results, chain: 'ETH' };
  }

  if (KNOWN_MIXER_ADDRESSES.has(addrLower)) {
    results.push(`🔴 <b>Known mixer/tumbler contract</b> – high AML risk`);
    score -= 30;
  }

  const [balRes, txRes, usdtRes, codeRes] = await Promise.allSettled([
    ethRpcCall('eth_getBalance', [address, 'latest']),
    ethRpcCall('eth_getTransactionCount', [address, 'latest']),
    ethRpcCall('eth_call', [{ to: USDT_ERC20, data: '0x70a08231' + addrLower.replace('0x', '').padStart(64, '0') }, 'latest']),
    ethRpcCall('eth_getCode', [address, 'latest']),
  ]);

  if (balRes.status === 'fulfilled' && balRes.value.result) {
    const balanceETH = parseInt(balRes.value.result, 16) / 1e18;
    results.push(`💰 Balance: <b>${balanceETH.toFixed(4)} ETH</b> (~$${(balanceETH * 3500).toFixed(0)})`);
    if (balanceETH > 1) score += 5;
    if (balanceETH > 10) score += 5;
  } else {
    results.push(`⚪ ETH balance unavailable`);
  }

  if (txRes.status === 'fulfilled' && txRes.value.result) {
    const txCount = parseInt(txRes.value.result, 16);
    results.push(`📊 Transactions: ${txCount}`);
    if (txCount > 500) { score += 10; }
    else if (txCount > 20) { score += 5; }
    else if (txCount < 3) { results.push(`🟡 Very low activity (${txCount} txs)`); score -= 5; }
  }

  if (codeRes.status === 'fulfilled' && codeRes.value.result && codeRes.value.result !== '0x') {
    results.push(`📋 This is a <b>smart contract</b>`);
  }

  if (usdtRes.status === 'fulfilled' && usdtRes.value.result) {
    const usdtBalance = parseInt(usdtRes.value.result, 16) / 1e6;
    if (usdtBalance > 0) {
      results.push(`💵 USDT (ERC-20): <b>${usdtBalance.toLocaleString()}</b>`);
      if (usdtBalance > 100000) { results.push(`🟢 Significant USDT holdings`); score += 5; }
    } else {
      results.push(`💵 USDT (ERC-20): 0`);
    }
  }

  score = Math.max(0, Math.min(100, score));
  return { score, results, chain: 'ETH' };
}

module.exports = { checkETH, ethRpcCall };
