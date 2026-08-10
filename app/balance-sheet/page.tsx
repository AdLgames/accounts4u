import { formatDecimal } from "@/lib/money";
import type { MinorUnits } from "@/lib/money";
import { buildBalanceSheet } from "@/lib/dashboard/balance-sheet";
import { resolveCurrentStore } from "@/lib/shopify/current-store";
import { AppShell } from "../_components/app-shell";
import { Card, CardLabel } from "../_components/card";
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
    <AppShell
      shop={shop}
      current="/balance-sheet"
      title="Balance Sheet"
      subtitle={`As of ${snapshot.asOf.toLocaleDateString()}`}
      lastSyncAt={store.lastSyncAt}
      banner={
        <>
          <RefreshStatus status={refreshed} />
          <TrialBanner shop={shop} trialEndsAt={store.trialEndsAt} subscriptionStatus={store.subscriptionStatus} />
        </>
      }
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <p className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 text-xs text-zinc-600 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-400">
          This is an estimate built from your order revenue and the bills you&apos;ve recorded — not a real bank balance, and
          not tax advice. No bank connection, inventory value, or accounts receivable is tracked.
        </p>

        <Card className="px-5 py-4">
          <CardLabel>Assets</CardLabel>
          <dl className="mt-2 flex flex-col text-sm">
            <Row label="Cash (estimated)" value={snapshot.cashEstimate} currency={currency} />
            <Row label="Total assets" value={snapshot.totalAssets} currency={currency} emphasis />
          </dl>
        </Card>

        <Card className="px-5 py-4">
          <CardLabel>Liabilities</CardLabel>
          <dl className="mt-2 flex flex-col text-sm">
            <Row label="Unpaid bills" value={snapshot.unpaidBills} currency={currency} />
            <Row label="Tax reserve owed (estimated)" value={snapshot.taxReserveOwed} currency={currency} />
            <Row label="Total liabilities" value={snapshot.totalLiabilities} currency={currency} emphasis />
          </dl>
        </Card>

        <Card className="border-teal-900/10 bg-gradient-to-b from-teal-50 to-white px-5 py-4 dark:border-teal-400/10 dark:from-teal-950/40 dark:to-zinc-950">
          <span className="text-[11px] font-semibold tracking-wide text-teal-700 uppercase dark:text-teal-400">Equity</span>
          <dl className="mt-2 flex flex-col text-sm">
            <div className="flex items-center justify-between py-1">
              <dt className="text-base font-semibold">Equity (assets − liabilities)</dt>
              <dd className="font-mono text-lg font-semibold">{money(currency, snapshot.equity)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Equity is a derived figure, not independently tracked — it&apos;s whatever makes assets and liabilities balance.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}

function Row({ label, value, currency, emphasis }: { label: string; value: MinorUnits; currency: string; emphasis?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${emphasis ? "border-t border-black/10 pt-2 font-semibold dark:border-white/10" : "py-0.5"}`}>
      <dt className="text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd className="font-mono">{money(currency, value)}</dd>
    </div>
  );
}
