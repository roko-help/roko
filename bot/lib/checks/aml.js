// AML check – OFAC SDN list + known mixer/scam databases
const { SANCTIONED_ADDRESSES, KNOWN_MIXER_ADDRESSES } = require('../data');

async function checkAML(address, chain) {
  const results = [];
  const addrLower = address.toLowerCase();

  if (SANCTIONED_ADDRESSES.has(addrLower) || SANCTIONED_ADDRESSES.has(address)) {
    results.push(`🔴 <b>AML: OFAC SANCTIONED</b> – this address is on the SDN list`);
    results.push(`⛔ Transacting with this address may violate US/EU sanctions laws`);
    return { sanctioned: true, results, riskLevel: 'critical' };
  }

  if (KNOWN_MIXER_ADDRESSES.has(addrLower)) {
    results.push(`🔴 <b>AML: Known mixer/tumbler</b> – high money laundering risk`);
    return { sanctioned: false, results, riskLevel: 'high' };
  }

  results.push(`🟢 AML: Not found in OFAC sanctions or known mixer databases`);
  results.push(`💡 For a deep AML check (transaction history, risk score) → @AMLBot`);
  return { sanctioned: false, results, riskLevel: 'low' };
}

module.exports = { checkAML };
