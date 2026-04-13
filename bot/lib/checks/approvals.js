// Token approval scanning for ETH and TRON
const { fetchJSON } = require('../http');
const { esc } = require('../telegram');
const { USDT_ERC20, USDT_TRC20 } = require('../config');
const { SANCTIONED_ADDRESSES } = require('../data');
const { ethRpcCall } = require('./eth');

async function checkETHApprovals(address) {
  const results = [];

  try {
    results.push(`\n🔍 <b>Token Approval Scanner (ETH)</b>`);

    const paddedAddr = address.toLowerCase().replace('0x', '').padStart(64, '0');
    const approvalTopic = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';

    const blockRes = await ethRpcCall('eth_blockNumber', []);
    if (!blockRes?.result) { results.push(`⚪ Approval scan unavailable`); return results; }

    const currentBlock = parseInt(blockRes.result, 16);
    const fromBlock = '0x' + Math.max(0, currentBlock - 200000).toString(16);

    const logsResult = await ethRpcCall('eth_getLogs', [{
      address: USDT_ERC20,
      topics: [approvalTopic, '0x' + paddedAddr],
      fromBlock,
      toBlock: 'latest',
    }]);

    if (logsResult?.result && logsResult.result.length > 0) {
      const approvals = logsResult.result;
      const activeApprovals = [];

      for (const log of approvals.slice(-10)) {
        const spender = '0x' + (log.topics[2] || '').slice(26);
        const amount = parseInt(log.data, 16);
        const isUnlimited = amount > 1e15;

        if (isUnlimited) activeApprovals.push({ spender, unlimited: true });
        else if (amount > 0) activeApprovals.push({ spender, amount: amount / 1e6, unlimited: false });
      }

      const unlimited = activeApprovals.filter(a => a.unlimited);
      if (unlimited.length > 0) {
        results.push(`🔴 <b>${unlimited.length} UNLIMITED approval(s) found!</b>`);
        results.push(`⚠️ These contracts can drain your USDT:`);
        for (const a of unlimited.slice(0, 3)) {
          const short = a.spender.slice(0, 10) + '...' + a.spender.slice(-6);
          const isBad = SANCTIONED_ADDRESSES.has(a.spender.toLowerCase());
          results.push(`  ${isBad ? '🔴' : '🟡'} ${esc(short)}${isBad ? ' – SANCTIONED!' : ''}`);
        }
        results.push(`\n💡 <b>Revoke:</b> revoke.cash`);
      }

      const limited = activeApprovals.filter(a => !a.unlimited);
      if (limited.length > 0) {
        results.push(`ℹ️ ${limited.length} limited approval(s) – normal for DEX usage`);
      }

      if (unlimited.length === 0 && limited.length === 0) {
        results.push(`🟢 Recent approvals are all zeroed – clean`);
      }
    } else {
      results.push(`🟢 No recent USDT approvals (last 30 days) – clean`);
    }

  } catch (e) {
    results.push(`⚪ ETH approval scan unavailable: ${esc(e.message)}`);
  }

  return results;
}

async function checkTRONApprovals(address) {
  const results = [];

  try {
    results.push(`\n🔍 <b>Token Approval Scanner (TRON)</b>`);

    const data = await fetchJSON(
      `https://api.trongrid.io/v1/contracts/${USDT_TRC20}/events?event_name=Approval&block_timestamp_min=${Date.now() - 90 * 86400000}&limit=50`
    );

    results.push(`ℹ️ TRON approval data requires TronScan Pro`);
    results.push(`💡 Check approvals: tronscan.org/#/address/${esc(address)} → Approvals tab`);
    results.push(`💡 Or use: tronlink.org wallet → Approval Management`);

  } catch (e) {
    results.push(`⚪ TRON approval scan: ${esc(e.message)}`);
  }

  return results;
}

module.exports = { checkETHApprovals, checkTRONApprovals };
