# Roko scoring algorithm

How Roko calculates trust scores for wallets and domains.

## Score range

Every check produces a score from **0 to 100**. The score is clamped – it never drops below 0 or rises above 100.

## Labels

| Score | Label | Color |
|-------|-------|-------|
| 70–100 | Low risk | Green |
| 40–69 | Medium risk | Yellow |
| 1–39 | High risk | Red |
| 0 | Sanctioned | Red |

A score of exactly 0 means the address or domain is on a sanctions or seizure list. The check short-circuits – no further analysis runs.

## Wallet scoring (BTC, ETH, TRON)

**Base score: 40**

### Sanctions check (all chains)

If the address appears in the OFAC SDN list or the hardcoded sanctions set, the check returns **score 0** immediately. No other factors apply.

If the address is a known mixer/tumbler (ETH only), score gets **-30**.

### Bitcoin (mempool.space)

| Factor | Condition | Points |
|--------|-----------|--------|
| High activity | >1,000 txs | +15 |
| Moderate activity | >50 txs | +10 |
| Some activity | >5 txs | +5 |
| Very low activity | <3 txs | -5 |
| Sweep pattern | ≤2 txs, zero balance, received >0 | -5 |
| Large balance | >1 BTC | +5 |
| Very large balance | >10 BTC | +5 (cumulative with above) |

Note: the web version uses slightly different thresholds (>100 txs = +15, >10 txs = +5, <5 txs = -5). The bot version above is more granular.

### Ethereum (llamarpc.com)

| Factor | Condition | Points |
|--------|-----------|--------|
| High activity | >500 outbound txs | +10 |
| Moderate activity | >20 outbound txs | +5 |
| Very low activity | <3 outbound txs | -5 |
| Balance >1 ETH | | +5 |
| Balance >10 ETH | | +5 (cumulative) |
| Significant USDT | >100,000 USDT (ERC-20) | +5 |

### TRON (trongrid.io)

| Factor | Condition | Points |
|--------|-----------|--------|
| USDT >50,000 | TRC-20 USDT balance | +10 |
| USDT >1,000 | TRC-20 USDT balance | +5 |
| Account age ≥1 year | | +15 |
| Account age ≥1 month | | +5 |
| Account very new | <~30 days | -10 |
| Has staked TRX | frozenV2 resources | +5 |
| Large TRX balance | >10,000 TRX | +5 |
| Address not found | No account on chain | score set to 20 |

### Not sanctioned bonus

If the address passes the sanctions check, all chains show a "not sanctioned" indicator (purely informational, no score change).

## Domain scoring

**Base score: 50**

### Database lookups

| Check | Condition | Points |
|-------|-----------|--------|
| Known scam | In scam-domains.json (garantex, tornado.cash, etc.) | -40 |
| Known warning | In warn-domains.json (ftx.com, celsius.network, etc.) | -10 |
| Known safe | In safe-domains.json | +3 to +15 (per-domain `boost` value) |

### Phishing detection

Only runs if the domain is not in the safe or scam lists.

| Check | Condition | Points |
|-------|-----------|--------|
| Typosquatting | Levenshtein distance ≤2 from a known brand | -25 |
| Brand substring | Domain contains a known brand name (e.g. `binance-verify.com`) | -15 |

Known brands checked: binance, bybit, coinbase, kraken, bestchange, okx, kucoin, gate, mexc, bitget, crypto, gemini, bitstamp, blockchain, trustwallet, metamask, trezor, ledger, exodus, etherscan, tronscan, bitcoin, ethereum, tether, uniswap, pancakeswap, opensea, coinmarketcap, coingecko, whitebit, exmo, bitfinex, htx, huobi.

### DNS (dns.google)

| Check | Condition | Points |
|-------|-----------|--------|
| DNS resolves | A records exist | +3 |
| DNS down | No A records | -25 |

### Domain age (rdap.org, fallback to WHOIS)

| Check | Condition | Points |
|-------|-----------|--------|
| Well established | ≥3 years | +15 |
| Established | ≥1 year | +8 |
| Relatively new | ≥3 months | -5 |
| Very new | <3 months | -15 |

If DNS is down but domain is registered, the age is shown as informational only (no score impact).

### SSL/HTTPS

| Check | Condition | Points |
|-------|-----------|--------|
| HTTPS works | Connection on port 443 succeeds (bot) | +5 |
| HTTPS fails | | -5 |

Note: the web version uses `fetch` with `mode: no-cors` and gives -8 for failure instead of -5.

### Site content scan (bot only)

The bot fetches the homepage HTML and looks for red flags:

| Check | Condition | Points |
|-------|-----------|--------|
| Brand mismatch | Domain name doesn't match `<title>` tag | -12 |
| Email mismatch | Contact email on different domain | -5 |
| No contact info | No email, contact, support references | -5 |
| Suspicious claims | "guaranteed profit", "100% safe" | -10 |
| Website builder | Wix, Squarespace, Tilda, Nicepage detected | -3 |
| Crypto on homepage | Wallet addresses embedded in page | -3 |
| Slow site | Response timeout | -3 |

### AI analysis (bot only, optional)

The bot can run an AI content analysis via Gemini Flash Lite. This is non-blocking – if the LLM orchestrator is unavailable, the check continues with deterministic scoring only.

| Category | Condition | Points |
|----------|-----------|--------|
| AML-drain | Site asks to connect wallet for fake AML verification | -30 |
| Token drain | Site requests dangerous token approvals | -25 |
| Phishing | Site impersonates a known brand | -25 |
| Scam exchange | Unrealistic claims, guaranteed returns | -15 |
| Legitimate | AI confident site is real (≥80% confidence) | +5 |

AI results only apply when confidence is ≥60%.

## Telegram handle checks

Handles (like `@crypto_dealer`) get pattern-based checks only – no numeric score. The web version returns `score: null` with a suggestion to use the bot for deeper analysis. The bot runs heuristics on handle patterns (support/admin/manager keywords, brand impersonation).

## Data sources

| Source | What it provides | Chain/type |
|--------|-----------------|------------|
| mempool.space | Balance, tx count | BTC |
| eth.llamarpc.com | Balance, tx count, USDT balance, contract detection, approvals | ETH |
| api.trongrid.io | Balance, USDT, account age, staking, approvals | TRON |
| dns.google | DNS A record resolution | Domains |
| rdap.org | Domain registration date, registrar | Domains |
| WHOIS (system) | Fallback for domain age | Domains |
| CoinGecko | Live prices for USD conversion | All wallets |
| data/ofac-addresses.json | OFAC SDN sanctioned wallet addresses | All wallets |
| data/scam-domains.json | Known scam/seized domains | Domains |
| data/safe-domains.json | Verified legitimate domains + boost values | Domains |
| data/warn-domains.json | Defunct/collapsed services | Domains |
| data/phishing-targets.json | Brand names for typosquatting detection | Domains |

## Known limitations

1. **No fallback APIs.** Each blockchain has a single API provider. If mempool.space is down, BTC checks fail entirely. Same for llamarpc (ETH) and trongrid (TRON).

2. **Static OFAC data between updates.** The `ofac-addresses.json` file is updated weekly via a script. Between updates, newly sanctioned addresses won't be caught.

3. **Phishing detection limited to Levenshtein ≤2.** Homoglyph attacks (using Unicode lookalikes like `bіnance.com` with Cyrillic і) or creative misspellings with distance >2 are not detected.

4. **No transaction graph analysis.** The checker looks at aggregate stats (balance, tx count, account age) but does not trace where funds came from or went. A clean-looking address could still have received funds from mixers.

5. **WHOIS is system-dependent.** The WHOIS fallback (when RDAP fails) shells out to the system `whois` command. Not available in all environments (e.g. Firebase Cloud Functions).

6. **AI analysis depends on external service.** The LLM orchestrator must be available for AI-based site scanning. When it's not, the bot falls back to deterministic checks only.

7. **Approval scanning is shallow.** ETH approval checks only look at USDT ERC-20 approvals in the last ~30 days (~200k blocks). Other tokens and older approvals are missed. TRON approval scanning currently redirects to TronScan.

## Contributing improvements

If you want to improve the scoring:

1. **Add to databases.** The easiest contribution – add domains to `data/scam-domains.json` or `data/safe-domains.json` via a PR or the "Report a scam" issue template.

2. **Suggest scoring changes.** Open an issue with the domain/address, current score, expected score, and why. Include evidence.

3. **Add fallback APIs.** See `docs/issues/fallback-apis.md` for the plan. Each chain check function needs a try/catch wrapper with a secondary API.

4. **Improve phishing detection.** The Levenshtein approach misses homoglyphs and creative misspellings. Ideas: Punycode decoding, visual similarity scoring, n-gram matching.
