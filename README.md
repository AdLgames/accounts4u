# PayoutClear

Real Shopify profit and payout clarity, without the accounting stack. See
[`PLAN.md`](./PLAN.md) for the full build plan and [`CLAUDE.md`](./CLAUDE.md)
for repo conventions.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL at minimum
npx prisma generate
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

- **Phase 1** (project skeleton): done. Next.js app, Prisma schema, money
  utilities in `lib/money.ts`, CI running lint/typecheck/test/build.
- **Phase 2** (Shopify integration, read-only): scaffolded, untested against
  a live store. OAuth install/callback (`/api/shopify/install`,
  `/api/shopify/callback`), webhook receiver + registration for
  `orders/create` and `refunds/create` (`/api/shopify/webhooks`), a 90-day
  backfill run on install, and a Vercel Cron sweep every 6 hours
  (`/api/shopify/sync`, see `vercel.json`) as the best-effort-webhook backup.
  Raw Shopify data lands append-only in `raw_orders`/`raw_transactions`/`raw_payouts`.

Still needed: a Vercel deployment (`SHOPIFY_APP_URL`, `DATABASE_URL`,
`SHOPIFY_API_KEY`/`SHOPIFY_API_SECRET`, `CRON_SECRET` as env vars there),
and a Shopify dev store to actually exercise the OAuth flow — this sandbox
can't reach Shopify's or Neon's servers, so only the pure logic (HMAC
verification, shop domain validation) has been tested here.
