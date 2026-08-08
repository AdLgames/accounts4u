# Build Plan: Shopify Profit & Payout Clarity Tool

**Working name:** PayoutClear (rename freely)
**One-line pitch:** Real numbers without the accounting stack — shows small Shopify merchants their true profit, payout breakdowns, and tax set-aside, replacing the spreadsheet instead of connecting to QuickBooks.
**Target customer:** Shopify stores doing under ~£10k/month who currently track profit in spreadsheets (or not at all) and can't justify QuickBooks + A2X + a bookkeeper (£60–120+/month).
**Price point:** £9–15/month flat, 14-day free trial, no per-order pricing.
**Founder edge:** Built by an accountant — tax treatment and reconciliation logic done properly, plus a natural distribution channel through accountant networks.

---

## How to use this document with Claude Code

Feed this file into Claude Code at the start of the project (e.g. place it in the repo root as `PLAN.md` and reference it in your `CLAUDE.md`). Work through the phases in order. Each phase ends with a verification checklist — do not move on until it passes. Ask Claude Code to build one phase at a time, not the whole plan at once.

Suggested kickoff prompt for Claude Code:
> Read PLAN.md. We are starting Phase 1. Set up the project skeleton exactly as specified, explain any deviation you think is necessary before making it, and stop at the Phase 1 checklist.

---

## Phase 0 — Validation (before writing real code)

**Goal: evidence that spreadsheet-merchants will pay, before building.**

1. Landing page: one page describing the product, price, and an email waitlist. Deploy on Vercel with the purchased domain.
2. Distribution test: post genuinely (not spam) in 3–5 places small merchants gather — Shopify Community forums, relevant subreddits, Facebook seller groups. Frame as "accountant building a tool, looking for 10 merchants to shape it."
3. Problem interviews: talk to 10–15 merchants (or draw on your own client base). Confirm: they use spreadsheets, the payout-vs-sales mismatch confuses them, and £9–15/month feels obviously worth it.
4. Kill criteria: if after ~3 weeks there are fewer than ~20 waitlist signups and no interviewee says "I'd pay for that today," stop or reposition before building. Sunk time is the enemy.
5. Check the platform risk: review what Shopify's native finance/analytics features currently cover, so the tool targets what Shopify does NOT do (true profit incl. ad spend/COGS, tax set-aside, plain-English payout explanation).

**Checklist:** landing page live · 10+ interviews done · 20+ signups OR a pivot decision · notes on Shopify-native feature overlap.

---

## Phase 1 — Project skeleton

**Stack (chosen for solo maintainability, near-zero fixed cost):**
- Next.js (App Router, TypeScript) — frontend + API routes in one deployable app
- PostgreSQL via a managed provider (Neon or Supabase free tier)
- Prisma ORM
- Deployed on Vercel
- Stripe for billing (Checkout + Customer Portal — no custom billing UI)
- Shopify OAuth + Admin GraphQL API for store data

**Structure:**
```
/app            — routes (marketing pages, dashboard, api)
/lib            — shopify client, stripe client, reconciliation engine
/lib/recon      — the accounting logic (pure functions, heavily tested)
/prisma         — schema
/tests          — unit tests, fixture payout data
PLAN.md         — this file
CLAUDE.md       — repo conventions for Claude Code
```

**CLAUDE.md should state:** TypeScript strict mode; all money handled as integer minor units (pence/cents), never floats; reconciliation logic lives in pure functions with fixture-based tests; no new dependencies without a stated reason.

**Checklist:** app deploys to Vercel · database migrates · CI runs typecheck + tests · money type/utilities in place.

---

## Phase 2 — Shopify integration (read-only)

**Goal: connect a store and pull the raw financial data.**

1. Shopify Partner account + public app registration (required for merchant onboarding — legacy custom-app onboarding is closed to new SaaS vendors).
2. OAuth flow with minimal read scopes: orders, payouts/Shopify Payments data, products (for COGS mapping later). Request nothing you don't use — it matters for app review.
3. Sync jobs: initial backfill (90 days) + incremental sync via webhooks (orders/create, refunds/create, payouts) with a scheduled reconciliation sweep as backup, since webhooks are best-effort.
4. Store raw data immutably (raw_orders, raw_transactions, raw_payouts tables) separate from derived/computed tables — accountant's principle: never lose the source records.

**Checklist:** dev store connects via OAuth · 90-day backfill completes · webhook updates land · raw vs derived data separated.

---

## Phase 3 — The reconciliation engine (the actual product)

**Goal: given a payout, explain it completely. This is where your accounting judgment gets encoded — review this code personally.**

Core function: `explainPayout(payoutId) → PayoutBreakdown`
- Decompose each payout into: gross sales, discounts, refunds, Shopify fees, payment processing fees, chargebacks, adjustments, tax collected.
- Every payout must balance to zero: components minus deductions must equal the deposited amount, or the payout is flagged "unexplained" with the residual shown. Never silently plug differences.
- Handle the known traps:
  - Payouts spanning month boundaries (split for period reporting)
  - Refunds landing in a later payout than their original sale
  - Marketplace-facilitator orders (e.g. Shop app) where Shopify remits the tax vs. store orders where the merchant must — tag tax lines accordingly
  - BNPL/installment fees that arrive separately from the payout
  - Multi-currency stores (v1: support single-currency, detect and warn on multi)
- Derived outputs:
  - True profit view: net sales − fees − refunds − COGS (manual per-product entry v1) − ad spend (manual monthly entry v1; ad platform APIs later)
  - Tax set-aside: configurable % rules producing a running "put this much away" figure — clearly labelled as an estimate, not tax advice
  - Monthly summary designed to be handed to an accountant at year-end (this is a feature AND the marketing hook)

**Testing:** build fixture files from real (anonymised) payout exports. Every bug found in the wild becomes a fixture. The engine is pure functions — no DB or API calls inside — so tests are fast and deterministic.

**Checklist:** 20+ fixture payouts all reconcile to zero · month-boundary and refund-lag fixtures pass · unexplained-residual path works · you have personally reviewed the tax tagging logic.

---

## Phase 4 — Dashboard

**Goal: the spreadsheet replacement. Three screens, no more.**

1. **Overview:** this month's true profit, money set aside for tax, next payout expected. Big numbers, plain English.
2. **Payouts:** list of deposits; click one → full breakdown ("£847.20 arrived: £1,020 sales − £61 fees − £84 refunds − £27.80 processing"). This screen IS the product demo.
3. **Settings:** COGS per product, recurring expenses, tax set-aside %, ad spend entry.

Design notes: mobile-friendly (merchants check phones), no accounting jargon on screen (jargon in tooltips), export-to-CSV everywhere.

**Checklist:** all three screens work against a live dev store · a non-accountant can explain their own payout after 60 seconds on screen 2.

---

## Phase 5 — Billing + launch plumbing

1. Stripe Checkout for subscription, Customer Portal for cancel/card changes, webhook → entitlement flag on the account. (You said you'll set up the Stripe account — the code just needs the keys.)
   - Note: if distributing through the Shopify App Store, Shopify requires its own billing API for app charges and takes a revenue share — decide early whether v1 launches via the App Store (their billing, their distribution) or as a standalone web app (Stripe, your own distribution). Recommended: standalone first with your accountant-channel distribution, App Store listing later as channel #2.
2. Trial logic: 14 days full access, read-only after expiry (don't delete their data — it's the reason they come back).
3. Essentials only: privacy policy, terms, GDPR data deletion endpoint (Shopify mandates specific compliance webhooks — implement them even pre-App-Store).
4. Error monitoring (Sentry free tier) + a simple admin page showing sync health per store.

**Checklist:** end-to-end: connect store → trial → pay → cancel → data export/delete all work.

---

## Phase 6 — Distribution (ongoing, starts during Phase 0)

- Your unfair advantage: accountants recommending tools is how this category's leader grew. Offer fellow accountants a partner view of their clients' dashboards.
- Content that ranks: "why your Shopify payout doesn't match your sales" style explainers — written by an actual accountant, which the AI-generated competition is not.
- The year-end summary export doubles as a referral loop: it lands on an accountant's desk with the product name on it.
- Shopify App Store listing as second channel once reviews/reliability are solid.

---

## Honest expectations

Median outcome in this space is a plateau at modest side income, and roughly 40% of micro SaaS products never reach £1k/month. The plan above is designed so the expensive part (Phases 1–5) only happens if Phase 0 produces evidence. Total cash cost to validate: domain + a few pounds of hosting. Total cost to build: mostly your evenings.

**Claude Code docs for reference during the build:** https://docs.claude.com/en/docs/claude-code/overview
