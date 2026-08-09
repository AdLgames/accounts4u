import { formatDecimal } from "@/lib/money";
import type { MinorUnits } from "@/lib/money";
import { buildBalanceSheet } from "@/lib/dashboard/balance-sheet";
import { resolveCurrentStore } from "@/lib/shopify/current-store";
import { AppNav } from "../_components/app-nav";
import { NotConnected } from "../_components/not-connected";
import { RefreshStatus } from "../_components/refresh-status";
import { TrialBanner } from "../_components/trial-banner";
import { firstParam } from "../_lib/search-params";

function money(currency: string, amount: MinorUnits): string {
  return `${currency} ${formatDecimal(amount)}`;
}

export default async function BalanceSheetPage({ searchParams }: PageProps<"/balance-sheet">) {
  const params = await searchParams;
  const shop = firstParam(params.shop);
  const idToken = firstParam(params.id_token);
  const refreshed = firstParam(params.refreshed);

  const store = await resolveCurrentStore(shop, idToken);
  if (!store || !shop) {
    return <NotConnected />;
  }

  const snapshot = await buildBalanceSheet(store.id);
  const currency = snapshot.currency ?? "";

  return (
    <div className="flex min-h-full flex-col">
      <AppNav shop={shop} current="/balance-sheet" />
      <RefreshStatus status={refreshed} />
      <TrialBanner shop={shop} trialEndsAt={store.trialEndsAt} subscriptionStatus={store.subscriptionStatus} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold">Balance Sheet</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">As of {snapshot.asOf.toLocaleDateString()}</p>

        <p className="mt-4 rounded border border-black/10 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-400">
          This is an estimate built from your Shopify payouts and the bills you&apos;ve recorded — not a real bank balance, and
          not tax advice. No bank connection, inventory value, or accounts receivable is tracked.
        </p>

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Assets</h2>
          <dl className="mt-2 flex flex-col gap-2 text-sm">
            <Row label="Cash (estimated)" value={snapshot.cashEstimate} currency={currency} />
            <Row label="Total assets" value={snapshot.totalAssets} currency={currency} emphasis />
          </dl>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Liabilities</h2>
          <dl className="mt-2 flex flex-col gap-2 text-sm">
            <Row label="Unpaid bills" value={snapshot.unpaidBills} currency={currency} />
            <Row label="Tax reserve owed (estimated)" value={snapshot.taxReserveOwed} currency={currency} />
            <Row label="Total liabilities" value={snapshot.totalLiabilities} currency={currency} emphasis />
          </dl>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Equity</h2>
          <dl className="mt-2 flex flex-col gap-2 text-sm">
            <Row label="Equity (assets − liabilities)" value={snapshot.equity} currency={currency} emphasis />
          </dl>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Equity is a derived figure, not independently tracked — it&apos;s whatever makes assets and liabilities balance.
          </p>
        </section>
      </main>
    </div>
  );
}

function Row({ label, value, currency, emphasis }: { label: string; value: MinorUnits; currency: string; emphasis?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${emphasis ? "border-t border-black/10 pt-2 font-semibold dark:border-white/10" : ""}`}>
      <dt className="text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd>{money(currency, value)}</dd>
    </div>
  );
}
