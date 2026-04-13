// Domain check – DNS, RDAP, WHOIS, SSL, site content scan, LLM analysis
const https = require('https');
const { execFileSync } = require('child_process');
const { resolve } = require('path');
const { fetchJSON, fetchText } = require('../http');
const { esc } = require('../telegram');
const { KNOWN_SCAM, KNOWN_GOOD, KNOWN_WARN, PHISHING_TARGETS, safeDomainsData, checkPhishing } = require('../data');

// --- LLM integration (graceful degradation) ---
let llmInstance = null;
let llmAvailable = null;

async function initLLM() {
  if (llmAvailable === false) return null;
  if (llmInstance) return llmInstance;
  try {
    const llmPath = process.env.LLM_PATH || resolve(__dirname, '../../../../LLM/lib/index.cjs');
    const { init } = require(llmPath);
    const { LLM } = await init();
    llmInstance = new LLM({ project: 'roko' });
    llmAvailable = true;
    console.log('🤖 LLM orchestrator connected');
    return llmInstance;
  } catch (e) {
    llmAvailable = false;
    console.log('⚠️ LLM orchestrator unavailable – AI analysis disabled');
    return null;
  }
}

const SITE_ANALYSIS_PROMPT = `You are a crypto security analyst. Classify this website's text content.

Categories:
- legitimate: real crypto exchange or service
- aml_drain: asks to "verify wallet" / "connect for AML check" / approve tokens for supposed compliance
- phishing: impersonates a known brand (Binance, Coinbase, etc.)
- scam_exchange: fake exchange with unrealistic promises, guaranteed returns
- token_drain: requests token approvals or wallet connection that could drain funds
- info: educational/news site, not an exchange

Red flags:
- "Connect wallet" for verification/AML/compliance
- Token approval requests disguised as security
- Guaranteed returns or unrealistic rates
- Urgency ("limited time", "act now")
- Requests for seed phrase or private key
- Claims of "free" tokens/airdrops requiring wallet connection

Reply ONLY with valid JSON:
{"category":"...","confidence":0.0-1.0,"flags":["flag1","flag2"],"summary":"1-2 sentences explaining the risk to a regular person"}

Website text:
`;

async function scanSiteAI(domain, html) {
  const llm = await initLLM();
  if (!llm) return null;

  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000);

  if (text.length < 50) return null;

  try {
    const result = await llm.chat({
      model: 'gemini-2.5-flash-lite',
      task: 'site-classify',
      messages: [{ role: 'user', content: SITE_ANALYSIS_PROMPT + text }],
      max_tokens: 300,
      temperature: 0,
    });

    const jsonStr = (typeof result === 'string' ? result : result?.text || '')
      .replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.log(`⚠️ AI analysis failed for ${domain}: ${e.message}`);
    return null;
  }
}

async function generateRiskSummary(target, checks, score, lang) {
  const llm = await initLLM();
  if (!llm) return null;

  const context = checks.join('\n');
  const langName = lang === 'ru' ? 'Russian' : lang === 'es' ? 'Spanish' : 'English';

  try {
    const result = await llm.chat({
      model: 'gemini-2.5-flash-lite',
      task: 'risk-summary',
      messages: [{ role: 'user', content:
        `Security check results for "${target}":\n${context}\n` +
        `Score: ${score}/100\n\n` +
        `Write 2-3 sentences in ${langName} explaining the risk to a regular person (not a crypto expert). ` +
        `Be specific about what's dangerous and what to do. No markdown, plain text only.`
      }],
      max_tokens: 200,
      temperature: 0.3,
    });

    return typeof result === 'string' ? result.trim() : (result?.text || '').trim();
  } catch {
    return null;
  }
}

// --- Individual domain checks ---

async function checkDNS(domain) {
  const dns = await fetchJSON(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`);
  if (dns.Answer && dns.Answer.length > 0) {
    const ip = dns.Answer[dns.Answer.length - 1].data;
    const cloudflare = dns.Answer.some(a => {
      const p = (a.data || '').split('.');
      return ['104', '172', '173', '188'].includes(p[0]);
    });
    return { resolves: true, ip, cloudflare };
  }
  return { resolves: false };
}

async function checkRDAP(domain) {
  const rdap = await fetchJSON(`https://rdap.org/domain/${encodeURIComponent(domain)}`);
  const regEvent = (rdap.events || []).find(e => e.eventAction === 'registration');
  if (!regEvent) return null;
  const regDate = new Date(regEvent.eventDate);
  const years = (Date.now() - regDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  const text = years >= 1 ? `${years.toFixed(1)} years (since ${regDate.getFullYear()})` : years >= (1/12) ? `${Math.round(years * 12)} months` : `${Math.round(years * 365)} days`;
  let registrar = null;
  const regEntity = (rdap.entities || []).find(e => (e.roles || []).includes('registrar'));
  if (regEntity?.vcardArray?.[1]) {
    const fn = regEntity.vcardArray[1].find(item => item[0] === 'fn');
    if (fn) registrar = fn[3];
  }
  return { years, text, date: regDate, registrar };
}

async function checkWHOIS(domain) {
  try {
    const raw = execFileSync('whois', [domain], { timeout: 10000, encoding: 'utf8' });
    const creationMatch = raw.match(/Creation Date:\s*(.+)/i) || raw.match(/created:\s*(.+)/i);
    const registrarMatch = raw.match(/Registrar:\s*(.+)/i);
    if (creationMatch) {
      const regDate = new Date(creationMatch[1].trim());
      if (isNaN(regDate)) return null;
      const years = (Date.now() - regDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      const text = years >= 1 ? `${years.toFixed(1)} years (since ${regDate.getFullYear()})` : years >= (1/12) ? `${Math.round(years * 12)} months` : `${Math.round(years * 365)} days`;
      return { years, text, registrar: registrarMatch ? registrarMatch[1].trim() : null };
    }
    return null;
  } catch { return null; }
}

async function checkSSL(domain) {
  return new Promise(res => {
    const req = https.request({ hostname: domain, port: 443, method: 'HEAD', timeout: 5000 }, () => res({ valid: true }));
    req.on('error', () => res({ valid: false, error: 'HTTPS unavailable or certificate error' }));
    req.on('timeout', () => { req.destroy(); res({ valid: false, error: 'Connection timeout' }); });
    req.end();
  });
}

async function scanSite(domain) {
  const findings = [];
  let rawHtml = '';
  try {
    const html = await fetchText(`https://${domain}`);
    rawHtml = html;
    const titleMatch = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    const siteTitle = titleMatch ? titleMatch[1].trim() : '';
    const emails = [...new Set((html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []))];
    const domainBase = domain.replace(/\.(com|io|net|org|cc|me|pro|exchange|trade|app|site|online|xyz)$/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const titleClean = siteTitle.replace(/[^a-z0-9]/gi, '').toLowerCase();

    if (siteTitle && domainBase.length > 3 && titleClean.length > 3) {
      const domainInTitle = titleClean.includes(domainBase) || domainBase.includes(titleClean.slice(0, 6));
      if (!domainInTitle && !titleClean.includes(domainBase.slice(0, 5))) {
        findings.push({ text: `🔴 <b>Brand mismatch:</b> domain "${esc(domain)}" but title says "${esc(siteTitle)}"`, scoreAdj: -12 });
      }
    }
    if (emails.length > 0) {
      const mismatch = emails.filter(e => { const d = e.split('@')[1].toLowerCase(); return d !== domain && !d.includes(domainBase) && !domainBase.includes(d.split('.')[0]); });
      if (mismatch.length > 0) findings.push({ text: `🟡 Contact email on different domain: ${esc(mismatch[0])}`, scoreAdj: -5 });
    }
    if (emails.length === 0 && !html.match(/contact|support|email|mailto/i)) {
      findings.push({ text: `🟡 No contact information found on homepage`, scoreAdj: -5 });
    }
    if (html.match(/guaranteed\s+(profit|return|income)/i) || html.match(/100%\s+(safe|secure|guaranteed)/i)) {
      findings.push({ text: `🔴 Suspicious claims: "guaranteed profit" or "100% safe"`, scoreAdj: -10 });
    }
    if (html.match(/u-body|nicepage|wix\.com|squarespace|tilda\.ws/i)) {
      findings.push({ text: `🟡 Built with a website builder/template`, scoreAdj: -3 });
    }
    if (html.match(/\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/) || html.match(/\b0x[a-fA-F0-9]{40}\b/) || html.match(/\bT[a-zA-Z0-9]{33}\b/)) {
      findings.push({ text: `🟡 Crypto address found on homepage – verify before sending`, scoreAdj: -3 });
    }
    if (siteTitle) findings.push({ text: `ℹ️ Site title: "${esc(siteTitle.slice(0, 80))}"`, scoreAdj: 0 });
  } catch (err) {
    if (err.message === 'timeout') findings.push({ text: `🟡 Site is very slow to respond`, scoreAdj: -3 });
  }
  return { findings, html: rawHtml };
}

// --- Main domain check ---

async function checkDomain(domain) {
  const results = [];
  let score = 50;
  const dl = domain.toLowerCase();

  if (KNOWN_SCAM[dl]) {
    results.push(`🔴 <b>SANCTIONED/SCAM:</b> ${esc(KNOWN_SCAM[dl])}`);
    score -= 40;
  }
  if (KNOWN_GOOD[dl]) {
    results.push(`🟢 ${esc(KNOWN_GOOD[dl].note)}`);
    score += KNOWN_GOOD[dl].boost;
  }
  if (KNOWN_WARN[dl]) {
    results.push(`🟡 ${esc(KNOWN_WARN[dl])}`);
    score -= 10;
  }

  if (!KNOWN_GOOD[dl] && !KNOWN_SCAM[dl]) {
    const phishing = checkPhishing(domain);
    if (phishing.length > 0) {
      const p = phishing[0];
      const brandDomain = PHISHING_TARGETS.includes(p.target)
        ? safeDomainsData.find(d => d.domain.startsWith(p.target))?.domain || p.target + '.com'
        : p.target + '.com';
      if (p.type === 'typosquat') {
        results.push(`🔴 <b>PHISHING ALERT:</b> this domain looks like ${esc(brandDomain)} (${p.distance} character${p.distance > 1 ? 's' : ''} different)`);
        score -= 25;
      } else {
        results.push(`🟡 <b>Impersonation risk:</b> domain contains brand name "${esc(p.target)}" – verify this is the official site`);
        score -= 15;
      }
    }
  }

  const [dnsResult, rdapResult, sslResult, siteResult] = await Promise.allSettled([
    checkDNS(domain), checkRDAP(domain), checkSSL(domain), scanSite(domain),
  ]);

  if (dnsResult.status === 'fulfilled' && dnsResult.value) {
    const dns = dnsResult.value;
    if (dns.resolves) {
      results.push(`🟢 DNS resolves → ${esc(dns.ip)}`);
      score += 3;
      if (dns.cloudflare) results.push(`ℹ️ Behind Cloudflare – real server IP hidden`);
    } else {
      results.push(`🔴 DNS does not resolve – site may be down or seized`);
      score -= 25;
    }
  } else {
    results.push(`⚪ DNS check: unavailable`);
  }

  if (rdapResult.status === 'fulfilled' && rdapResult.value) {
    const age = rdapResult.value;
    if (age.years >= 3) { results.push(`🟢 Domain age: ${esc(age.text)} – well established`); score += 15; }
    else if (age.years >= 1) { results.push(`🟢 Domain age: ${esc(age.text)}`); score += 8; }
    else if (age.years >= 0.25) { results.push(`🟡 Domain age: ${esc(age.text)} – relatively new`); score -= 5; }
    else { results.push(`🔴 Domain age: ${esc(age.text)} – very new, higher risk`); score -= 15; }
    if (age.registrar) results.push(`ℹ️ Registrar: ${esc(age.registrar)}`);
  } else {
    const whois = await checkWHOIS(domain);
    if (whois) {
      if (whois.years >= 3) { results.push(`🟢 Domain age: ${esc(whois.text)} (WHOIS)`); score += 15; }
      else if (whois.years >= 1) { results.push(`🟢 Domain age: ${esc(whois.text)} (WHOIS)`); score += 8; }
      else if (whois.years >= 0.25) { results.push(`🟡 Domain age: ${esc(whois.text)} (WHOIS) – relatively new`); score -= 5; }
      else { results.push(`🔴 Domain age: ${esc(whois.text)} (WHOIS) – very new`); score -= 15; }
      if (whois.registrar) results.push(`ℹ️ Registrar: ${esc(whois.registrar)}`);
    } else {
      results.push(`⚪ Domain age: could not determine`);
    }
  }

  if (sslResult.status === 'fulfilled') {
    const ssl = sslResult.value;
    if (ssl.valid) { results.push(`🟢 SSL: valid, HTTPS works`); score += 5; }
    else { results.push(`🟡 SSL: ${esc(ssl.error)}`); score -= 5; }
  }

  let siteHtml = '';
  if (siteResult.status === 'fulfilled' && siteResult.value) {
    for (const finding of siteResult.value.findings) {
      results.push(finding.text);
      score += finding.scoreAdj;
    }
    siteHtml = siteResult.value.html || '';
  }

  if (siteHtml && siteHtml.length > 100) {
    try {
      const aiResult = await scanSiteAI(domain, siteHtml);
      if (aiResult && aiResult.confidence >= 0.6) {
        const cat = aiResult.category;
        if (cat === 'aml_drain') {
          results.push(`🔴 <b>AI: AML-drain detected</b> – site asks to connect wallet for fake "AML verification"`);
          if (aiResult.summary) results.push(`ℹ️ ${esc(aiResult.summary)}`);
          score -= 30;
        } else if (cat === 'token_drain') {
          results.push(`🔴 <b>AI: Token drain risk</b> – site may request dangerous token approvals`);
          if (aiResult.summary) results.push(`ℹ️ ${esc(aiResult.summary)}`);
          score -= 25;
        } else if (cat === 'phishing') {
          results.push(`🔴 <b>AI: Phishing detected</b> – site impersonates a known brand`);
          if (aiResult.summary) results.push(`ℹ️ ${esc(aiResult.summary)}`);
          score -= 25;
        } else if (cat === 'scam_exchange') {
          results.push(`🟡 <b>AI: Suspicious exchange</b> – unrealistic claims detected`);
          if (aiResult.summary) results.push(`ℹ️ ${esc(aiResult.summary)}`);
          score -= 15;
        } else if (cat === 'legitimate' && aiResult.confidence >= 0.8) {
          results.push(`🟢 AI: Site content looks legitimate`);
          score += 5;
        }
      }
    } catch {
      // AI unavailable – continue with deterministic checks only
    }
  }

  score = Math.max(0, Math.min(100, score));
  let emoji, label;
  if (score >= 70) { emoji = '🟢'; label = 'Low risk'; }
  else if (score >= 40) { emoji = '🟡'; label = 'Medium risk'; }
  else { emoji = '🔴'; label = 'High risk'; }

  return { score, emoji, label, results, domain };
}

module.exports = { checkDomain, checkDNS, generateRiskSummary };
