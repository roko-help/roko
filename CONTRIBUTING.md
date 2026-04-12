# Contributing to Roko

Thanks for helping make crypto safer! Here's how you can contribute.

## No code required

### Report a scam domain
1. [Open an issue](../../issues/new?template=report-scam.yml) with the domain and evidence
2. Or edit `data/scam-domains.json` directly and open a PR

Format:
```json
{ "domain": "scam-site.com", "reason": "Why it's a scam", "source": "Where you found this info", "added": "2026-04-12" }
```

### Add a safe domain
Edit `data/safe-domains.json` and open a PR. Only add well-known, regulated exchanges with verifiable licenses.

Format:
```json
{ "domain": "exchange.com", "note": "Short description", "boost": 5 }
```

Boost values: 3 (minor), 5 (established), 8 (well-known), 10-15 (major regulated exchange)

### Add a translation
Roko supports English, Russian, and Spanish. To add a new language or fix a translation:

1. Find the `T` object in `public/index.html` (search for `var T={`)
2. Add your language code following the existing pattern
3. Update the language buttons in the HTML

## Code contributions

### Setup
```bash
git clone https://github.com/roko-help/roko.git
cd roko

# Web (no dependencies needed)
npx serve -l 3457 public/

# Bot (needs token)
# Add ROKO_TELEGRAM_TOKEN to your env
node bot/index.js
```

### What needs help
- **Phishing detection improvements** – better similarity algorithms, more brand coverage
- **New blockchain checks** – Solana, Polygon, Arbitrum support
- **Localization** – new languages, especially Arabic, Chinese, Portuguese, Turkish
- **Mobile UX** – improvements for mobile browsers
- **Documentation** – usage guides, API documentation

### Code style
- No build step, no framework – vanilla JS
- Keep `index.html` self-contained (inline CSS/JS)
- Bot: Node.js, no external dependencies beyond Node stdlib
- All data in `data/*.json` – never hardcode domains or addresses in code

### Pull request process
1. Fork and create a branch (`feature/my-improvement`)
2. Make your changes
3. Test locally (web: `npx serve public/`, bot: `node bot/index.js`)
4. Open a PR with a clear description of what and why

## Code of conduct

Be respectful. We're all here to make crypto safer. No spam, no promotion of exchanges, no personal attacks.
