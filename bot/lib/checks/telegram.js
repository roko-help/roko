// Telegram handle check via t.me profile scraping
const { fetchText } = require('../http');
const { esc } = require('../telegram');

async function checkTelegramHandle(handle) {
  const results = [];
  let score = 30;

  try {
    const html = await fetchText(`https://t.me/${handle}`);
    if (html.includes('tgme_page_title') || html.includes('tgme_channel_info')) {
      const nameMatch = html.match(/tgme_page_title[^>]*>([^<]+)/);
      const name = nameMatch ? nameMatch[1].trim() : '';
      const descMatch = html.match(/tgme_page_description[^>]*>([^<]{0,200})/);
      const desc = descMatch ? descMatch[1].trim() : '';
      const isChannel = html.includes('tgme_channel_info');
      const membersMatch = html.match(/([\d\s]+)\s*(?:members|subscribers)/i);

      results.push(`🟢 Account exists: ${esc(name || handle)}`);
      if (isChannel) results.push(`ℹ️ This is a channel/group`);
      if (membersMatch) results.push(`ℹ️ ${membersMatch[1].trim()} members`);
      if (desc) results.push(`ℹ️ Bio: "${esc(desc.slice(0, 120))}"`);
      score += 10;

      const combined = (name + ' ' + desc).toLowerCase();
      if (combined.match(/guaranteed|100%|profit|безопасн/)) { results.push(`🟡 Suspicious language`); score -= 5; }
      if (combined.match(/manager|support|admin|operator/)) { results.push(`🟡 Generic "manager/support" naming – could be impersonation`); score -= 5; }
    } else if (html.includes('page_not_found')) {
      results.push(`🔴 Account @${esc(handle)} does not exist or was deleted`);
      score -= 20;
    } else {
      results.push(`🟢 Account @${esc(handle)} exists (personal account)`);
      score += 5;
    }
  } catch {
    results.push(`⚪ Could not fetch Telegram profile`);
  }

  if (handle.match(/^\d+$/)) { results.push(`🔴 Username is just numbers – suspicious`); score -= 10; }
  if (handle.match(/manager|support|admin|operator|helper/i)) { results.push(`🟡 "manager/support" in name – common scam trick`); score -= 5; }
  if (handle.length > 20) { results.push(`🟡 Very long username – unusual`); score -= 3; }
  const brandMatch = handle.match(/(binance|coinbase|bybit|kraken|bestchange|trust|wallet)/i);
  if (brandMatch) { results.push(`🔴 Contains "${esc(brandMatch[1])}" – pretending to be a known exchange?`); score -= 10; }

  score = Math.max(0, Math.min(100, score));
  let emoji, label;
  if (score >= 60) { emoji = '🟢'; label = 'Likely legitimate'; }
  else if (score >= 35) { emoji = '🟡'; label = 'Proceed with caution'; }
  else { emoji = '🔴'; label = 'High risk'; }

  return { score, emoji, label, results, handle };
}

module.exports = { checkTelegramHandle };
