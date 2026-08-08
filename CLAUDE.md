# CLAUDE.md

Repo conventions for this project. See `PLAN.md` for the phased build plan — work one phase at a time and stop at each phase's checklist.

## Conventions

- **TypeScript strict mode** everywhere. No `any` without a comment explaining why it's unavoidable.
- **Money is always integer minor units** (pence/cents), never floats. Use the helpers in `lib/money.ts` for all arithmetic, formatting, and parsing — never do raw arithmetic on money values inline.
- **Reconciliation logic lives in pure functions** under `lib/recon/`, with no DB or network calls inside. Every function there gets fixture-based tests in `tests/`. Every bug found in the wild becomes a new fixture.
- **No new dependencies without a stated reason.** Prefer the standard library or what's already in `package.json`.
- **Raw data is immutable.** Data synced from Shopify (`raw_orders`, `raw_transactions`, `raw_payouts`) is never mutated in place — derived/computed tables are separate.

## Stack

Next.js (App Router, TypeScript) · PostgreSQL via Prisma · Vercel · Stripe (Checkout + Customer Portal) · Shopify OAuth + Admin GraphQL API.

## Structure

```
/app            — routes (marketing pages, dashboard, api)
/lib            — shopify client, stripe client, reconciliation engine
/lib/recon      — the accounting logic (pure functions, heavily tested)
/prisma         — schema
/tests          — unit tests, fixture payout data
PLAN.md         — phased build plan
```
