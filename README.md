# 🦝 Roko — Check before you send

Free, open-source crypto safety checker. Paste a domain, wallet address, or Telegram handle — get a risk assessment in seconds.

**Web:** [roko.help](https://roko.help) · **Bot:** [@RokoHelpBot](https://t.me/RokoHelpBot) · **Alerts:** [@roko_help](https://t.me/roko_help)

---

## Why we built this

Roman had been using an exchanger and recommended it to Peter. But the site had turned into an AML-drain scam — it asked Peter to "verify his wallet for AML compliance." He connected his wallet and lost his funds.

The domain was old. Everything looked legit. We're both experienced in crypto and IT. We still got scammed.

If it happened to us, it can happen to anyone. So we built Roko.

## What it checks

| Input | What Roko does |
|-------|---------------|
| **Domain** (e.g. `exchanger.com`) | DNS, WHOIS age, SSL, phishing similarity to known brands, sanctions lists, site content AI analysis |
| **Wallet** (BTC / ETH / TRON) | Balance, transaction count, account age, USDT balance, OFAC sanctions screening |
| **@handle** (Telegram) | Suspicious patterns ("manager", "support"), brand impersonation |

## Quick start

### Use it
- **Web:** Open [roko.help](https://roko.help), paste a link or address, hit Check
- **Telegram:** Send any link/address to [@RokoHelpBot](https://t.me/RokoHelpBot)

### Run locally
```bash
# Web (static, no build step)
npx serve -l 3457 public/

# Bot (requires ROKO_TELEGRAM_TOKEN in /path/to/LLM/.env)
node bot/index.js
```

### Deploy
```bash
npx firebase deploy --only hosting --project roko-help
```

## Contribute

**The easiest way to help — no code required:**

1. **Report a scam domain** → [open an issue](../../issues/new?template=report-scam.yml)
2. **Add a safe domain** → edit [`data/safe-domains.json`](data/safe-domains.json) and open a PR
3. **Add a translation** → see [CONTRIBUTING.md](CONTRIBUTING.md)

### Project structure
```
data/                  ← Open scam/safe databases (JSON)
  scam-domains.json       Scam & sanctioned domains
  safe-domains.json       Verified safe domains
  warn-domains.json       Closed / problematic services
  phishing-targets.json   Brands for phishing detection
  ofac-addresses.json     OFAC sanctioned crypto addresses (auto-updated)
public/                ← Web app (static HTML, no framework)
  index.html              Main page + checker
  quest.html              Scam Quest (interactive game)
bot/                   ← Telegram bot
  index.js                Bot with full checks + AI analysis
scripts/               ← Utilities
  update-ofac.js          OFAC SDN list parser
```

## How scoring works

Roko does **not** use purchasable reviews. Scoring is based on:

- **Domain age** — 90% of scam sites are less than a month old
- **DNS/SSL** — is the site even real and secure?
- **Phishing detection** — Levenshtein distance to known brand domains
- **Sanctions lists** — OFAC SDN, known mixers, seized domains
- **AI content analysis** — LLM scans site content for AML-drain, phishing, and token approval patterns (bot only)
- **Blockchain data** — wallet balance, age, activity patterns

All checks use public APIs. No proprietary data. Fully reproducible.

## 🎮 Scam Quest

Interactive game with 7 real-world scam scenarios. Can you spot the scam?

Play: [roko.help/quest](https://roko.help/quest)

## Tech stack

- **Frontend:** Vanilla HTML/CSS/JS (zero dependencies, works offline)
- **Bot:** Node.js, Telegram Bot API
- **AI:** Gemini Flash Lite (free tier) via LLM orchestrator — zero API costs
- **Data:** Public APIs (dns.google, rdap.org, mempool.space, TronGrid, Etherscan)
- **Hosting:** Firebase Hosting / GitHub Pages

## Authors

Built by [Roman Selivan](https://romanselivan.com) & [Peter Farbey](https://farbey.xyz) — for friends, and for you.

## License

MIT — do whatever you want with it.
