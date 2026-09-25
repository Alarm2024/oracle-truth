# Oracle Truth — 3-Minute Demo Video Script

**Target length:** ~3 minutes (~450 words at conversational pace)

---

## [0:00–0:20] Hook — The problem

**Visual:** Dashboard loading, quick cut of a perp trade UI (mock or screenshot).

**Narration:**

> "Before you open a perp or resolve a prediction market, how do you know the oracle price is fresh, fair, and aligned with the rest of the market? Oracle Truth is a read-only pre-trade safety gate for Solana — no keys, no trading, just evidence."

---

## [0:20–0:50] What it does

**Visual:** Architecture diagram or repo tree overlay; highlight `packages/core`.

**Narration:**

> "Oracle Truth pulls mark and oracle prices from Drift and Jupiter Perps, compares them to a multi-venue spot median — Binance, OKX, Kraken, Coinbase, and Jupiter — and returns allow or refuse with a reason code. Every refusal ships evidence: prices, ages, sources, and timestamps."

**Visual:** Show reason code table in README.

---

## [0:50–1:30] Live dashboard — clean allow

**Visual:** Browser at `http://localhost:3000`. Click **Refresh All Assets**.

**Narration:**

> "Here's the live dashboard. SOL, BTC, and ETH each get a gate card. Green means allow — spot median, mark, and oracle are within thresholds, venues agree, oracle is fresh."

**Visual:** Expand venue prices on SOL card; point out spot median and divergence in bps.

---

## [1:30–2:15] Fixture demos — refusals with evidence

**Visual:** Select **Fixture: stale-oracle** from dropdown → Refresh.

**Narration:**

> "For demos without waiting for real staleness, we use seeded fixtures. Stale oracle — reason code ORACLE_STALE — oracle age exceeds thirty seconds. The evidence block shows exactly what failed."

**Visual:** Switch to **diverged-oracle** → Refresh.

> "Diverged — DIVERGED_X_BPS — mark price is two hundred basis points off the spot median."

**Visual:** Quick flash of **venues-disagree** and **rpc-behind** cards (5 seconds each).

> "We also refuse when venues disagree or RPC slot lag is too high."

---

## [2:15–2:40] Prediction resolution

**Visual:** Enter strike `140`, click **Check Prediction Resolution**.

**Narration:**

> "For prediction markets — 'SOL above a hundred forty dollars at time T' — we fetch every source, hash the raw responses, and show whether consensus is tight enough to resolve yes, no, or ambiguous."

**Visual:** Scroll resolution table — source, price, hash prefix.

---

## [2:40–2:55] Clients & tests

**Visual:** Terminal — `npm test` passing; split screen with TS and Rust client one-liners.

**Narration:**

> "Bots integrate via TypeScript or Rust clients, or embed the core library directly. Tests use fixtures — each refusal reason code has an expected outcome."

---

## [2:55–3:00] Close

**Visual:** GitHub repo URL, MIT license, Limits section in README.

**Narration:**

> "Oracle Truth — read-only safety before you trade. Repo linked below. MIT licensed. No keys, no profit claims, just UNKNOWN when we don't know."

---

## Production notes

- Record terminal and browser at 1080p; use fixture mode if live APIs are slow
- Blur any API keys — none should be present
- Optional B-roll: Solana explorer slot height (read-only)
- Background music: low, neutral; duck under narration
