# Database governance model

## Current state

The scam/safe/warn domain lists in `data/` are maintained by 2 people via direct git commits. The OFAC address list auto-updates weekly via `scripts/parse-ofac.js`.

There's a "Report a scam" issue template (`.github/ISSUE_TEMPLATE/report-scam.yml`) but no formal review process for additions.

## Desired state

A clear, documented process for how domains and addresses get added to or removed from the databases. Community members can propose changes; maintainers review and merge.

## Proposed process

### Adding a scam domain

1. Reporter opens a "Report a scam" issue with evidence (screenshots, transaction hashes, victim reports).
2. A maintainer verifies the evidence. Minimum bar: at least one concrete proof (stolen funds tx, phishing page screenshot, law enforcement notice).
3. Maintainer adds the domain to `data/scam-domains.json` with `source` and `added` fields.
4. PR merged, deploy runs.

### Adding a safe domain

1. Anyone can open a "Suggest safe domain" issue (template already exists).
2. Maintainer checks: is this a real, regulated, operating exchange or service?
3. Assigns a `boost` value based on regulation level and track record.
4. PR merged.

### Disputing a listing

1. If someone believes a domain is incorrectly listed (scam that's actually safe, or safe that's been compromised), they open a regular issue.
2. Maintainers review evidence from both sides.
3. Domain is moved, removed, or kept based on evidence.

### OFAC list

Automated. The `scripts/parse-ofac.js` script downloads the SDN list and updates `data/ofac-addresses.json`. Runs weekly via cron or manually. No community input needed – this is a government list.

## Possible future additions

- A `CODEOWNERS` file requiring review from at least 1 maintainer for changes to `data/`.
- A GitHub Action that validates JSON syntax in `data/` files on every PR.
- Community voting on disputed domains (e.g. thumbs-up/thumbs-down on the issue, 5+ votes needed to overturn).
- A public feed (RSS or Telegram channel post) when new scam domains are added.

## Files to change

- `CONTRIBUTING.md` – add governance section
- `.github/CODEOWNERS` – new file, protect `data/` directory
- `.github/workflows/` – optional JSON validation action
