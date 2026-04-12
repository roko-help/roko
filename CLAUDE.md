# Roko – Check before you send

## What
Free crypto safety checker. Paste a domain, wallet, or Telegram handle – get a risk score in seconds.

## URLs
- **Web:** https://roko.help
- **Firebase project:** `roko-help`
- **Bot:** @RokoHelpBot (Telegram)
- **Channel:** @roko_help (Telegram)
- **Repo:** https://github.com/roko-help/roko

## Deploy
```bash
npx firebase deploy --only hosting --project roko-help
```

## Project structure
```
public/           – static web app (single HTML, no framework)
  index.html        main page + checker
  quest.html        Scam Quest (interactive game)
bot/              – Telegram bot
  index.js          polling bot with full checks + AI
data/             – open scam/safe databases (JSON)
scripts/          – utilities (OFAC parser, domain setup)
functions/        – Firebase Cloud Functions (bot webhook)
```

## Bot
Runs via Firebase Cloud Functions (webhook mode), not polling.
Local dev: `node bot/index.js` (polling mode, needs token in env).

## LLM
AI analysis uses Gemini Flash Lite (free tier) via LLM orchestrator.
Graceful degradation – bot works without AI if orchestrator unavailable.

## i18n
EN (default), RU, ES. Auto-detects browser language.

## Key concept
Roko is NOT an aggregator. It's a safety checker –
scam databases, sanctions, phishing detection, AI site analysis.
For regular people, not crypto experts.
