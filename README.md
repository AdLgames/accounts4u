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

Phase 1 (project skeleton) is in place: Next.js app, Prisma schema stub,
money utilities in `lib/money.ts`, CI running lint/typecheck/test/build.

Still needed before later phases: a real Postgres database (Neon or
Supabase), a Vercel deployment, a Shopify Partner account for OAuth
credentials, and a Stripe account — none of these can be provisioned from
this environment.
