import Link from "next/link";
import { formatDecimal, minorUnits } from "@/lib/money";
import type { MinorUnits } from "@/lib/money";
import { buildProfitAndLossTrend } from "@/lib/dashboard/profit-and-loss";
import { resolveCurrentStore } from "@/lib/shopify/current-store";
import { AppShell } from "./_components/app-shell";
import { Card, CardLabel } from "./_components/card";
import { NotConnected } from "./_components/not-connected";
import { RefreshStatus } from "./_components/refresh-status";
import { Stat } from "./_components/stat";
import { TrialBanner } from "./_components/trial-banner";
import { firstParam } from "./_lib/search-params";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthLabel(month: string): string {
  const [year, monthIndex] = month.split("-").map(Number);
  return `${MONTH_NAMES[monthIndex - 1]} ${year}`;
}

function money(currency: string, amount: MinorUnits): string {
  return `${currency} ${formatDecimal(amount)}`;
}

export default async function ProfitAndLossPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const shop = firstParam(params.shop);
  const idToken = firstParam(params.id_token);
  const refreshed = firstParam(params.refreshed);
  const trendMonths = firstParam(params.months) === "12" ? 12 : 6;

  const store = await resolveCurrentStore(shop, idToken);
  if (!store || !shop) {
    return <NotConnected />;
  }

  const trend = await buildProfitAndLossTrend(store.id, trendMonths);
  const statement = trend[trend.length - 1];
  const currency = statement.currency ?? "";

  return (
    <AppShell
      shop={shop}
      current="/"
      title="Profit & Loss"
      subtitle={monthLabel(statement.month)}
      lastSyncAt={store.lastSyncAt}
      banner={
        <>
          <RefreshStatus status={refreshed} />
          <TrialBanner shop={shop} trialEndsAt={store.trialEndsAt} subscriptionStatus={store.subscriptionStatus} />
        </>
      }
    >
      <div className="mx-auto w-full max-w-4xl">
        {statement.saleCount === 0 && (
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
            No orders yet this month — the statement below will fill in as orders come in.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Stat
            label="Net profit this month"
            value={money(currency, statement.netProfit)}
            detail="Net sales after refunds, payment fees (Shopify Payments only), product costs, and operating expenses."
            accent
          />
          <Stat
            label="Set aside for tax"
            value={money(currency, statement.taxSetAside)}
            detail="An estimate based on the percentage set in Inputs — not tax advice."
          />
        </div>

        <Card className="mt-6 overflow-hidden">
          <div className="px-5 pt-4">
            <CardLabel>Statement</CardLabel>
          </div>
          <dl className="flex flex-col px-5 pt-2 pb-4 text-sm">
            <StatementRow label="Revenue" value={statement.revenue} currency={currency} />
            {statement.revenueByCategory.map((category) => (
              <StatementRow key={category.category} label={category.category} value={category.amount} currency={currency} indent />
            ))}
            {statement.refunds !== 0 && <StatementRow label="Refunds" value={minorUnits(-statement.refunds)} currency={currency} />}
            <StatementRow label="Net sales" value={statement.netSales} currency={currency} emphasis />
            <StatementRow label="Cost of goods sold" value={minorUnits(-statement.cogs)} currency={currency} />
            <StatementRow label="Gross profit" value={statement.grossProfit} currency={currency} emphasis />

            {statement.operatingExpenses.map((expense) => (
              <StatementRow key={expense.category} label={expense.category} value={minorUnits(-expense.amount)} currency={currency} indent />
            ))}
            {statement.operatingExpenses.length > 0 && (
              <StatementRow label="Operating expenses" value={minorUnits(-statement.operatingExpensesTotal)} currency={currency} />
            )}

            {statement.fees !== 0 && <StatementRow label="Payment fees" value={minorUnits(-statement.fees)} currency={currency} />}
            {statement.chargebacks !== 0 && (
              <StatementRow label="Chargebacks" value={minorUnits(-statement.chargebacks)} currency={currency} />
            )}
            <StatementRow label="Net profit" value={statement.netProfit} currency={currency} emphasis />
          </dl>
        </Card>

        {statement.revenueByCategory.length === 0 && (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Set a revenue category per product in Inputs to break Revenue down by type here.
          </p>
        )}

        {statement.cogs === 0 && statement.revenue !== 0 && (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
            No product costs set — gross profit above equals revenue, which overstates your real margin. Add a cost per
            product in Inputs for an accurate number.
          </p>
        )}

        {statement.otherPaymentActivity !== 0 && (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            {money(currency, statement.otherPaymentActivity)} of other Shopify Payments activity this month (adjustments/reserves)
            — shown for reference, not included in Net Profit above.
          </p>
        )}

        {statement.pendingCashAmount !== 0 && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {money(currency, statement.pendingCashAmount)} of this month&apos;s Shopify Payments revenue hasn&apos;t reached your
            bank yet — see Payouts.
          </p>
        )}

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <CardLabel>Revenue &middot; month by month</CardLabel>
            <div className="flex gap-3 text-xs">
              <Link
                href={`/?shop=${encodeURIComponent(shop)}&months=6`}
                className={trendMonths === 6 ? "font-semibold text-teal-700 dark:text-teal-400" : "text-zinc-500 hover:underline dark:text-zinc-400"}
              >
                6mo
              </Link>
              <Link
                href={`/?shop=${encodeURIComponent(shop)}&months=12`}
                className={trendMonths === 12 ? "font-semibold text-teal-700 dark:text-teal-400" : "text-zinc-500 hover:underline dark:text-zinc-400"}
              >
                12mo
              </Link>
            </div>
          </div>
          <Card className="mt-3 overflow-x-auto px-5 py-4">
            <table className="w-full min-w-[480px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-black/10 text-left text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                  <th className="py-1 pr-2 font-medium">Month</th>
                  <th className="py-1 pr-2 text-right font-medium">Revenue</th>
                  <th className="py-1 pr-2 text-right font-medium">COGS</th>
                  <th className="py-1 pr-2 text-right font-medium">Gross profit</th>
                  <th className="py-1 text-right font-medium">Net profit</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {trend.map((month) => (
                  <tr key={month.month} className="border-b border-black/5 last:border-0 dark:border-white/5">
                    <td className="py-1.5 pr-2 font-sans whitespace-nowrap">{monthLabel(month.month)}</td>
                    <td className="py-1.5 pr-2 text-right">{formatDecimal(month.revenue)}</td>
                    <td className="py-1.5 pr-2 text-right">{formatDecimal(month.cogs)}</td>
                    <td className="py-1.5 pr-2 text-right">{formatDecimal(month.grossProfit)}</td>
                    <td className="py-1.5 text-right font-medium">{formatDecimal(month.netProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}

function StatementRow({
  label,
  value,
  currency,
  emphasis,
  indent,
}: {
  label: string;
  value: MinorUnits;
  currency: string;
  emphasis?: boolean;
  indent?: boolean;
}) {
  const sign = value < 0 ? "−" : "";
  return (
    <div className={`flex items-center justify-between ${emphasis ? "border-t border-black/10 pt-2 font-semibold dark:border-white/10" : "py-0.5"}`}>
      <dt className={indent ? "pl-4 text-zinc-500 dark:text-zinc-400" : "text-zinc-600 dark:text-zinc-400"}>{label}</dt>
      <dd className="font-mono">
        {sign} {money(currency, minorUnits(Math.abs(value)))}
      </dd>
    </div>
  );
}
