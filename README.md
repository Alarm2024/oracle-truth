# Oracle Truth

Pre-trade safety gate for Solana perpetuals and prediction markets. Compares on-chain oracle/mark prices against a multi-venue spot reference, measures oracle freshness and RPC lag, and produces auditable allow/refuse decisions with evidence.

**Hackathon project — read-only, no keys, no trading.**

## Quick start

```bash
# Install dependencies
npm install

# Run tests (seeded fixtures)
npm test

# Build all TypeScript packages
npm run build

# Start API + dashboard (local Node server)
npm run dev
# Open http://localhost:3000
```

### Deploy on Vercel (free / Hobby)

No secrets required. Serverless functions run in **fra1** (Frankfurt) so venue APIs that block US IPs still work.

1. Push this repo to GitHub (or connect another Git remote).
2. In [Vercel](https://vercel.com): **Add New… → Project** and import the repo.
3. Leave **Root Directory** as `.` (repo root). Framework Preset can stay **Other**.
4. Build settings are already in `vercel.json`:
   - Install: `npm install`
   - Build: `npm run build --workspace @oracle-truth/core`
   - Output: `packages/dashboard` (static dashboard)
   - Region: `fra1`
5. Deploy — do **not** add environment variables.
6. Open the deployment URL: dashboard at `/`, APIs at `/api/gate/SOL` and `/api/prediction/resolve?asset=SOL&strike=140`.

Local `npm run dev` still serves the same dashboard and routes via the Node HTTP server in `@oracle-truth/api`.

### Rust client

```bash
cd clients/rust
cargo test
cargo run --example check_gate   # requires API running
```

### TypeScript client

```bash
npm run build --workspace @oracle-truth/client
ORACLE_TRUTH_URL=http://localhost:3000 npx tsx clients/ts/src/example.ts
```

## Repo structure

```
oracle-truth/
├── api/               # Vercel serverless functions (gate + prediction)
├── packages/
│   ├── core/          # Gate logic, spot/perp fetchers, resolution evidence
│   ├── api/           # Local HTTP API server (npm run dev)
│   └── dashboard/     # Static live dashboard (Vercel outputDirectory)
├── clients/
│   ├── ts/            # TypeScript client
│   └── rust/          # Rust client
├── fixtures/          # Seeded test scenarios
├── docs/
│   └── demo-script.md # 3-minute demo video script
├── vercel.json        # fra1 region, static dashboard, function includes
└── README.md
```

## Gate API

| Endpoint | Description |
|----------|-------------|
| `GET /api/gate/:asset` | Live gate check for SOL, BTC, or ETH |
| `GET /api/gate/:asset?mode=fixture&fixture=stale-oracle` | Fixture mode for demos/tests |
| `GET /api/gate/all` | All assets at once |
| `GET /api/prediction/resolve?asset=SOL&strike=140` | Resolution evidence with source hashes |
| `GET /api/health` | Health check |

### Response shape

```json
{
  "decision": "refuse",
  "reasonCode": "ORACLE_STALE",
  "evidence": {
    "asset": "SOL",
    "spotReference": 145.5,
    "markPrice": 145.58,
    "oraclePrice": 145.57,
    "divergenceBps": 5,
    "oracleAgeMs": 120000,
    "venuePrices": [...],
    "thresholds": {...},
    "timestamp": "..."
  }
}
```

### Reason codes

| Code | Meaning |
|------|---------|
| `ORACLE_STALE` | Oracle last update older than threshold (default 30s) |
| `DIVERGED_X_BPS` | Mark/oracle diverges from spot median beyond threshold (default 50 bps) |
| `RPC_BEHIND` | RPC slot lag exceeds threshold (default 150 slots) |
| `VENUES_DISAGREE` | Spot venue spread exceeds threshold (default 100 bps) |

Every **refuse** includes full evidence: prices, ages, sources, timestamps.

## Perps integration (read-only)

- **Drift** — public stats API (`mainnet-beta.api.drift.trade`)
- **Jupiter Perps** — public markets API (`perps-api.jup.ag`)
- **Spot reference** — median of responding venues: Binance, OKX, Kraken, Coinbase, Jupiter Price API v3 (`api.jup.ag/price/v3`)

## Prediction markets — resolution evidence

For questions like *"SOL above $X at time T"*:

1. Fetch every configured source at resolution time (live) or from fixture input
2. Store each response with a SHA-256 hash for audit trail
3. Report median, consensus spread, and whether sources agree enough to resolve

## Environment variables (optional)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | API/dashboard port |
| `SOLANA_RPC_URL` | public mainnet-beta | Read-only slot queries |
| `ORACLE_TRUTH_URL` | `http://localhost:3000` | Client base URL |

No secrets required for read-only public endpoints.

## Tests

Fixtures in `/fixtures` cover all four refusal reason codes plus a clean allow:

```bash
npm test
# packages/core/tests/gate.test.ts — asserts decision + reasonCode per fixture
```

## Hackathon rules

**No hackathon rules were found pasted in this repository** (only an empty initial README). The following rules were provided in the project brief and are assumed for this submission:

- Read-only: devnet or mainnet reads only
- No keys in code, no trading, no profit claims
- No invented numbers — use `UNKNOWN` when data unavailable
- Disclose open-source dependencies in README (see below)
- README includes this Limits section
- Includes a 3-minute demo video script (`docs/demo-script.md`)

## Open-source disclosures

All **new application code** in this repo was written during the hackathon event. We use standard open-source **libraries** (not copied application logic):

| Dependency | License | Use |
|------------|---------|-----|
| TypeScript, Node.js | MIT / Apache | Runtime & language |
| Vitest | MIT | Tests |
| reqwest, serde, tokio (Rust) | MIT/Apache | Rust client |

Public **data APIs** (read-only, no SDK required): Binance, OKX, Kraken, Coinbase, Jupiter Price API v3, Drift stats API, Jupiter Perps API, Solana public RPC.

## Limits

- **Read-only only** — no transactions, signing, or private keys
- **No profit claims** — this tool provides informational gate decisions, not financial advice
- **Live API availability** — external venues may rate-limit or fail; failed fetches return `UNKNOWN` and may affect median/consensus calculations
- **Drift/Jupiter API shapes** — public endpoints may change; mark/oracle scaling assumes documented precision (Drift uses 1e6); verify against live responses
- **Historical resolution** — live `/api/prediction/resolve` fetches *current* prices; true time-T resolution requires archived snapshots (fixture POST endpoint provided for demos)
- **RPC slot lag** — oracle slot from Drift stats may be unavailable; lag defaults to `UNKNOWN` unless oracle slot is provided
- **Thresholds** — defaults (30s stale, 50 bps divergence, 150 slot lag, 100 bps venue spread) are configurable in code but not yet exposed via API env vars
- **Assets** — SOL, BTC, ETH only
- **Network** — defaults to Solana mainnet-beta public RPC; devnet supported via `SOLANA_RPC_URL`
- **No on-chain program** — gate is off-chain; bots call HTTP API or embed `@oracle-truth/core` directly

## License

MIT — see [LICENSE](LICENSE).
