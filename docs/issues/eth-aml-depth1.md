# ETH depth-1 AML check

## Problem

Roko currently does depth-1 AML scans for BTC (mempool.space) and TRON (TronGrid) – checking if a wallet's counterparties appear in OFAC sanctions lists. ETH wallets only get balance + nonce via LlamaRPC, which doesn't expose transaction history.

## Goal

Add depth-1 counterparty scanning for Ethereum addresses, matching what BTC and TRON already do.

## Approach

ETH RPC nodes (`eth_getBalance`, `eth_getTransactionCount`) don't return transaction history. Need an indexed API:

**Option A: Etherscan free API** (recommended)
- `module=account&action=txlist&address={addr}&startblock=0&endblock=99999999&sort=desc&page=1&offset=25`
- Free tier: 5 calls/sec, 100K calls/day
- Returns full tx list with `from` / `to` addresses in standard hex
- Requires API key (free registration)

**Option B: Blockscout API**
- Similar to Etherscan but open-source
- No API key needed for basic queries
- Slower, less reliable

## Implementation

1. Add Etherscan API key to bot env (or LLM orchestrator `.env`)
2. In `bot/lib/checks/eth.js`: fetch last 25 transactions, extract `from`/`to` addresses, check against `SANCTIONED_ADDRESSES`
3. In `public/index.html` `checkChain` ETH section: same logic using `fetch()`
4. Handle rate limits gracefully (fallback to current behavior if 429)

## Files to modify

- `bot/lib/checks/eth.js` – add depth-1 scan after existing balance/nonce check
- `public/index.html` – `checkChain` ETH block (~line 1549)
- `bot/lib/config.js` – add Etherscan API key config

## Reference

See BTC implementation in `bot/lib/checks/btc.js` (depth-1 section) and TRON in `bot/lib/checks/tron.js` for the pattern.
