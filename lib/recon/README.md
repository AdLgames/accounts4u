# Reconciliation engine

Pure functions only — no DB or network calls in this directory. Every
function gets fixture-based tests in `/tests/recon` and `/tests/fixtures/recon`,
and every bug found in the wild becomes a new fixture.

- `explain-payout.ts` — `explainPayout(payout, transactions) → PayoutBreakdown`, the
  core function: decomposes a payout's balance transactions into named
  categories and checks they fully account for the deposited amount.
- `split-by-month.ts` — groups a payout's transactions by calendar month, for
  period reporting when a payout spans a month boundary.
- `from-raw.ts` — converts raw Shopify JSON (as stored in `raw_payouts`/
  `raw_transactions`) into the normalized types the engine works with. Not
  yet verified against a live payout export — re-check field names before
  trusting this in production.
- `types.ts` — the domain model (`Payout`, `BalanceTransaction`, `PayoutBreakdown`).
