import Link from "next/link";
import { formatDecimal, minorUnits } from "@/lib/money";
import type { MinorUnits } from "@/lib/money";
import { buildProfitAndLossTrend } from "@/lib/dashboard/profit-and-loss";
import { resolveCurrentStore } from "@/lib/shopify/current-store";
import { AppNav } from "./_components/app-nav";
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
    <div className="flex min-h-full flex-col">
      <AppNav shop={shop} current="/" />
      <RefreshStatus status={refreshed} />
      <TrialBanner shop={shop} trialEndsAt={store.trialEndsAt} subscriptionStatus={store.subscriptionStatus} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold">Profit &amp; Loss</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{monthLabel(statement.month)}</p>

        {statement.saleCount === 0 && (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            No orders yet this month — the statement below will fill in as orders come in.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-6">
          <Stat
            label="Net profit this month"
            value={money(currency, statement.netProfit)}
            detail="Net sales after refunds, payment fees (Shopify Payments only), product costs, and operating expenses."
          />
          <Stat
            label="Set aside for tax"
            value={money(currency, statement.taxSetAside)}
            detail="An estimate based on the percentage set in Inputs — not tax advice."
          />
        </div>

        <dl className="mt-8 flex flex-col gap-2 text-sm">
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

        {statement.revenueByCategory.length === 0 && (
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            Set a revenue category per product in Inputs to break Revenue down by type here.
          </p>
        )}

        {statement.otherPaymentActivity !== 0 && (
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
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

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Month by month</h2>
            <div className="flex gap-3 text-xs">
              <Link
                href={`/?shop=${encodeURIComponent(shop)}&months=6`}
                className={trendMonths === 6 ? "font-semibold underline" : "text-zinc-500 hover:underline dark:text-zinc-400"}
              >
                6mo
              </Link>
              <Link
                href={`/?shop=${encodeURIComponent(shop)}&months=12`}
                className={trendMonths === 12 ? "font-semibold underline" : "text-zinc-500 hover:underline dark:text-zinc-400"}
              >
                12mo
              </Link>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
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
              <tbody>
                {trend.map((month) => (
                  <tr key={month.month} className="border-b border-black/5 dark:border-white/5">
                    <td className="py-1.5 pr-2 whitespace-nowrap">{monthLabel(month.month)}</td>
                    <td className="py-1.5 pr-2 text-right">{formatDecimal(month.revenue)}</td>
                    <td className="py-1.5 pr-2 text-right">{formatDecimal(month.cogs)}</td>
                    <td className="py-1.5 pr-2 text-right">{formatDecimal(month.grossProfit)}</td>
                    <td className="py-1.5 text-right font-medium">{formatDecimal(month.netProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
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
    <div className={`flex items-center justify-between ${emphasis ? "border-t border-black/10 pt-2 font-semibold dark:border-white/10" : ""}`}>
      <dt className={indent ? "pl-4 text-zinc-500 dark:text-zinc-400" : "text-zinc-600 dark:text-zinc-400"}>{label}</dt>
      <dd>
        {sign} {money(currency, minorUnits(Math.abs(value)))}
      </dd>
    </div>
  );
}
