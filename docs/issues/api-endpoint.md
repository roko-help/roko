# Public API endpoint for integrations

## Current state

Roko's check logic runs client-side in the browser (public/index.html) and server-side in the Telegram bot (bot/index.js). There's no HTTP API that third-party tools can call.

## Desired state

A public REST API that accepts a domain, wallet address, or Telegram handle and returns a structured JSON response with the score and checks.

## Endpoint design

```
GET https://api.roko.help/check?q={input}
```

### Response

```json
{
  "input": "garantex.org",
  "type": "domain",
  "score": 10,
  "label": "High risk",
  "checks": [
    { "type": "fail", "text": "SANCTIONED/SCAM: OFAC sanctioned, seized by law enforcement" },
    { "type": "fail", "text": "DNS does not resolve" }
  ],
  "timestamp": "2026-04-13T12:00:00Z"
}
```

### Rate limiting

- 10 requests per minute per IP
- 100 requests per day per IP (without API key)
- Higher limits with an API key (future)

### Error responses

```json
{ "error": "rate_limited", "retry_after": 45 }
{ "error": "invalid_input", "message": "Could not detect address type or domain" }
```

## Implementation options

### Option A: Firebase Cloud Function

Add a new function in `functions/` alongside the existing bot webhook. Reuse the check logic from `bot/index.js`.

Pros: already have Firebase set up, auto-scaling, HTTPS by default.
Cons: cold starts, 60s timeout for complex checks, cost at scale.

### Option B: Standalone Express server

A small Express app that imports the check functions from `bot/index.js` (after extracting them to a shared module).

Pros: more control, no cold starts, can run on the same VPS as the bot.
Cons: needs its own deploy, SSL, monitoring.

### Recommended: Option A for MVP

Start with a Firebase Cloud Function. If usage grows, move to a standalone server.

## Files to change

- `bot/index.js` – extract `checkAddress`, `checkDomain`, `checkPhishing` to a shared module (e.g. `bot/lib/checks.js`)
- `functions/` – add API function
- `firebase.json` – add rewrite rule for `/api/check`
