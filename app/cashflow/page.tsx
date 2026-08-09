import { buildCashflowTrailing13Weeks, type CashflowWeek } from "@/lib/dashboard/cashflow";
import type { ExpenseLine } from "@/lib/dashboard/profit-and-loss";
import { add, formatDecimal, minorUnits, type MinorUnits } from "@/lib/money";
import { resolveCurrentStore } from "@/lib/shopify/current-store";
import { AppShell } from "../_components/app-shell";
import { Card, CardLabel } from "../_components/card";
import { CashflowChart } from "../_components/cashflow-chart";
import { NotConnected } from "../_components/not-connected";
import { RefreshStatus } from "../_components/refresh-status";
import { Stat } from "../_components/stat";
import { TrialBanner } from "../_components/trial-banner";
import { firstParam } from "../_lib/search-params";

function weekLabel(weekStart: string): string {
  const date = new Date(`${weekStart}T00:00:00.000Z`);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function aggregateCategories(weeks: CashflowWeek[], pick: "cashInByCategory" | "cashOutByCategory"): ExpenseLine[] {
  const totals = new Map<string, MinorUnits>();
  for (const week of weeks) {
    for (const line of week[pick]) {
      totals.set(line.category, add(totals.get(line.category) ?? minorUnits(0), line.amount));
    }
  }
  return [...totals.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

export default async function CashflowPage({ searchParams }: PageProps<"/cashflow">) {
  const params = await searchParams;
  const shop = firstParam(params.shop);
  const idToken = firstParam(params.id_token);
  const refreshed = firstParam(params.refreshed);

  const store = await resolveCurrentStore(shop, idToken);
  if (!store || !shop) {
    return <NotConnected />;
  }

  const weeks = await buildCashflowTrailing13Weeks(store.id);
  const currency = weeks.find((week) => week.currency)?.currency ?? "";

  const totalCashIn = add(...weeks.map((week) => week.cashIn));
  const totalCashOut = add(...weeks.map((week) => week.cashOut));
  const totalNet = add(...weeks.map((week) => week.netCashFlow));
  const cashInByCategory = aggregateCategories(weeks, "cashInByCategory");
  const cashOutByCategory = aggregateCategories(weeks, "cashOutByCategory");

  return (
    <AppShell
      shop={shop}
      current="/cashflow"
      title="Cashflow"
      subtitle={`Trailing 13 weeks, ${weekLabel(weeks[0].weekStart)} – today`}
      lastSyncAt={store.lastSyncAt}
      banner={
        <>
          <RefreshStatus status={refreshed} />
          <TrialBanner shop={shop} trialEndsAt={store.trialEndsAt} subscriptionStatus={store.subscriptionStatus} />
        </>
      }
    >
      <div className="mx-auto w-full max-w-4xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Cash in (13 weeks)" value={`${currency} ${formatDecimal(totalCashIn)}`} accent />
          <Stat label="Cash out (13 weeks)" value={`${currency} ${formatDecimal(totalCashOut)}`} />
          <Stat label="Net cash flow (13 weeks)" value={`${currency} ${formatDecimal(totalNet)}`} />
        </div>

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <CardLabel>Cash in / cash out by week</CardLabel>
            <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500 opacity-75" /> In
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-rose-500 opacity-75" /> Out
              </span>
            </div>
          </div>
          <Card className="mt-3 overflow-x-auto px-5 py-5">
            <CashflowChart weeks={weeks} />
          </Card>
        </section>

        <section className="mt-8">
          <CardLabel>Week by week</CardLabel>
          <Card className="mt-3 overflow-x-auto px-5 py-4">
            <table className="w-full min-w-[480px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-black/10 text-left text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                  <th className="py-1 pr-2 font-medium">Week of</th>
                  <th className="py-1 pr-2 text-right font-medium">Cash in</th>
                  <th className="py-1 pr-2 text-right font-medium">Cash out</th>
                  <th className="py-1 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {weeks.map((week) => (
                  <tr key={week.weekStart} className="border-b border-black/5 last:border-0 dark:border-white/5">
                    <td className="py-1.5 pr-2 font-sans whitespace-nowrap">{weekLabel(week.weekStart)}</td>
                    <td className="py-1.5 pr-2 text-right">{formatDecimal(week.cashIn)}</td>
                    <td className="py-1.5 pr-2 text-right">{formatDecimal(week.cashOut)}</td>
                    <td className="py-1.5 text-right font-medium">{formatDecimal(week.netCashFlow)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="px-5 py-4">
            <CardLabel>Incoming, by category</CardLabel>
            {cashInByCategory.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">No cash in over the last 13 weeks.</p>
            ) : (
              <dl className="mt-2 flex flex-col gap-1.5 text-sm">
                {cashInByCategory.map((line) => (
                  <div key={line.category} className="flex items-center justify-between">
                    <dt className="text-zinc-600 dark:text-zinc-400">{line.category}</dt>
                    <dd className="font-mono">
                      {currency} {formatDecimal(line.amount)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
          <Card className="px-5 py-4">
            <CardLabel>Outgoing, by category</CardLabel>
            {cashOutByCategory.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">No paid bills over the last 13 weeks.</p>
            ) : (
              <dl className="mt-2 flex flex-col gap-1.5 text-sm">
                {cashOutByCategory.map((line) => (
                  <div key={line.category} className="flex items-center justify-between">
                    <dt className="text-zinc-600 dark:text-zinc-400">{line.category}</dt>
                    <dd className="font-mono">
                      {currency} {formatDecimal(line.amount)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
