# Roko – Crypto Exchange Trust Index

## What
Trust scoring service for crypto exchangers (online, offline, P2P).
"Don't trust reviews. Trust the blockchain." 🦝

## URLs
- **Production:** https://roko-help.web.app (temporary)
- **Domain:** https://roko.help (pending registration)
- **Firebase project:** `roko-help`
- **Bot:** @RokoHelpBot (Telegram)
- **Channel:** @roko_help (Telegram, auto-posts scam alerts + weekly digest)

## Deploy
```bash
npx firebase deploy --only hosting --project roko-help
```

## Project Structure
```
public/          – Firebase Hosting (landing page)
  index.html     – main landing page (EN/RU/ES)
bot/             – Telegram bot
  index.js       – bot scaffold (polling, basic commands)
scripts/         – setup and utility scripts
  setup-domain.js – Porkbun API: register + DNS for Firebase
  register-domain.js – (legacy) first attempt
```

## Domain Setup (roko.help)
Domain not yet registered. Steps:
1. Verify phone + email at porkbun.com/account
2. Add credit ($10 min) at porkbun.com billing
3. Run `node scripts/setup-domain.js`
4. Add custom domain in Firebase Console
5. Run `node scripts/setup-domain.js verify <txt-value>`
6. Wait for SSL (up to 24h)

Porkbun API keys are in `/Users/roman/Projects/LLM/.env`:
- `PORKBUN_API_KEY`
- `PORKBUN_SECRET_KEY`

## Bot Setup
1. Create bot via @BotFather → get token
2. Add `ROKO_TELEGRAM_TOKEN=xxx` to `/Users/roman/Projects/LLM/.env`
3. Run `node bot/index.js`

## LLM Orchestrator
All LLM calls via `/Users/roman/Projects/LLM/`:
```javascript
const { init } = require('/Users/roman/Projects/LLM/lib/index.cjs');
const { LLM } = await init();
const llm = new LLM({ project: 'roko', task: 'score-analysis' });
```

### Models
| Task | Model | Why |
|------|-------|-----|
| Review analysis | `gemini-2.5-flash-lite` | Cheapest, classification |
| Safety recommendations | `deepseek` | Good Russian/English, cheap |
| Complex scoring | `haiku` | Only if simpler models insufficient |

## GitHub
- **Repo:** https://github.com/roko-help/roko
- **Remote:** `origin` → `git@github.com:roko-help/roko.git`
- **Branch:** `main`
- **gh CLI:** authenticated, `GITHUB_TOKEN` in `/Users/roman/Projects/LLM/.env`

### Push changes
```bash
cd /Users/roman/Projects/roko
git add -A && git commit -m "description of changes" && git push
```

### After significant updates
Also update repo description/topics if needed:
```bash
gh repo edit roko-help/roko --description "new description"
gh repo edit roko-help/roko --add-topic new-topic
```

## Firebase Deploy Safety
ALWAYS use `--project roko-help` flag when deploying.

## i18n
Landing page supports EN (default), RU, ES via client-side JSON.
Auto-detects browser language. Translations in inline `i18n` object.

## Key Concept
Roko is NOT an aggregator (BestChange does that).
Roko is a Trust Index – scores exchangers as business entities
using blockchain data, not purchasable reviews.
