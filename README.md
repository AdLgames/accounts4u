# PayoutClear

Real Shopify profit and payout clarity, without the accounting stack. See
[`PLAN.md`](./PLAN.md) for the full build plan and [`CLAUDE.md`](./CLAUDE.md)
for repo conventions.

## Getting started

```bash
npm install   # runs `prisma generate` automatically via postinstall
cp .env.example .env.local   # fill in DATABASE_URL at minimum
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript, no emit
- `npm run test` — Vitest

## Status

- **Phase 1** (project skeleton): done.
- **Phase 2** (Shopify integration, read-only): done, verified live against
  a real dev store. Embedded app using Token Exchange (not the classic
  OAuth redirect — see `app/page.tsx`/`lib/shopify/session.ts`), webhook
  registration + receiver for `orders/create`/`refunds/create`, a 90-day
  backfill, and a Vercel Cron sweep (`/api/shopify/sync`, see `vercel.json`)
  as the best-effort-webhook backup. Raw Shopify data lands append-only in
  `raw_orders`/`raw_transactions`/`raw_payouts`. Known gap: nothing refreshes
  the stored access token before use yet — fine for install-time backfill,
  but the cron sweep or any call made after the 60-minute token expiry will
  fail until a refresh-before-use pass is added.
- **Phase 3** (reconciliation engine): `explainPayout()` in `lib/recon/`,
  pure and fixture-tested (22 fixtures in `tests/fixtures/recon/`). Not yet
  wired up to real payout data — `lib/recon/from-raw.ts` converts raw
  Shopify JSON into the engine's input types but hasn't been checked
  against a live payout export.

Deployed on Vercel, connected to a real Shopify dev store and Neon
Postgres — env vars (`SHOPIFY_APP_URL`, `DATABASE_URL`, `SHOPIFY_API_KEY`,
`NEXT_PUBLIC_SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `CRON_SECRET`,
`SESSION_SECRET`) are set there. This sandbox itself still can't reach Shopify's, Neon's, or Vercel's
servers directly — all Phase 2 verification happened by the human running
each step and reporting back logs/query results.
