# Add fallback blockchain APIs

## Current state

Each blockchain check relies on a single API provider:

| Chain | Primary API | Failure mode |
|-------|------------|--------------|
| BTC | mempool.space | Check returns "unavailable" |
| ETH | eth.llamarpc.com | Check returns "unavailable" |
| TRON | api.trongrid.io | Check returns "unavailable" |

If the primary API is down or rate-limited, the entire chain check fails and the user gets no useful data.

## Desired state

Each chain check tries a secondary API when the primary fails. The score and results should be equivalent regardless of which API answered.

## Suggested fallbacks

| Chain | Primary | Fallback 1 | Fallback 2 |
|-------|---------|------------|------------|
| BTC | mempool.space | blockstream.info/api | blockchain.info/rawaddr |
| ETH | eth.llamarpc.com | cloudflare-eth.com | 1rpc.io/eth |
| TRON | api.trongrid.io | api.tronscan.org | nile.trongrid.io (testnet only) |

## Implementation

Each check function (`checkBTC`, `checkETH`, `checkTRON`) needs:

1. Wrap the primary API call in try/catch
2. On failure, call a `fetchWithFallback` helper that tries the next provider
3. Normalize the response format (different APIs return slightly different shapes)
4. Add a "data source" indicator to results so users know which API answered

Example pattern:

```javascript
async function fetchBTCData(address) {
  try {
    return await fetchJSON(`https://mempool.space/api/address/${address}`);
  } catch {
    // Fallback to blockstream
    const data = await fetchJSON(`https://blockstream.info/api/address/${address}`);
    // blockstream uses same format as mempool.space
    return data;
  }
}
```

For ETH, the fallback RPCs use the same JSON-RPC interface, so the `ethRpcCall` function just needs a configurable endpoint URL.

## Files to change

- `bot/index.js` – `checkBTC`, `checkETH`, `checkTRON` functions
- `public/index.html` – `checkChain` function (web version)
- Consider extracting API URLs to a config object at the top of each file
