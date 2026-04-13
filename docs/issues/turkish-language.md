# Add Turkish language (TR)

## Current state

Roko supports 3 languages: English (default), Russian, Spanish. Auto-detection uses the browser's `navigator.language` for web and the user's Telegram language for the bot.

## Why Turkish

Turkey consistently ranks in the top 5 countries for crypto adoption. A large portion of crypto scam victims are Turkish speakers. Adding TR would significantly expand Roko's reach.

## What needs translating

### Web (public/index.html)

The `T` object contains all UI strings. Copy the `en` values and translate to Turkish. Approximately 60 keys including:

- Page title, tagline, button labels
- Score labels (Low risk, Medium risk, High risk, Sanctioned)
- Check result messages (DNS OK, domain age, etc.)
- Safety guide text
- Scam Quest scenarios and answers

### Bot (bot/index.js)

The `I` object contains all bot messages. Add a `tr` key to each entry. Approximately 30 keys including:

- /start and /help messages
- Score labels
- Guide messages
- Watch/unwatch confirmations
- Error messages

### Scam Quest (public/quest.html or embedded in index.html)

Quest scenarios need translation. Each scenario has a title, description, options with explanations.

## Implementation

1. Add `'tr'` to the language selector (web: language dropdown, bot: /lang command).
2. Add `tr:` entries to every key in the `T` object (web) and `I` object (bot).
3. Add Turkish to browser language detection: `navigator.language.startsWith('tr')`.
4. Test all screens in TR – some strings may be longer and break layout.

## How to contribute

1. Fork the repo.
2. Search for `en:` or `ru:` in `public/index.html` to find all translatable strings.
3. Add `tr:` with the Turkish translation next to each entry.
4. Do the same in `bot/index.js` for the `I` object.
5. Open a PR with `[i18n] Add Turkish language` as the title.

Use the EN version as the source of truth (RU and ES are already verified translations).
