import { formatDecimal, minorUnits } from "@/lib/money";
import type { MinorUnits } from "@/lib/money";
import { buildProfitAndLoss } from "@/lib/dashboard/profit-and-loss";
import { resolveCurrentStore } from "@/lib/shopify/current-store";
import { AppNav } from "./_components/app-nav";
import { NotConnected } from "./_components/not-connected";
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

  const store = await resolveCurrentStore(shop, idToken);
  if (!store || !shop) {
    return <NotConnected />;
  }

  const statement = await buildProfitAndLoss(store.id);
  const currency = statement.currency ?? "";

  return (
    <div className="flex min-h-full flex-col">
      <AppNav shop={shop} current="/" />
      <TrialBanner shop={shop} trialEndsAt={store.trialEndsAt} subscriptionStatus={store.subscriptionStatus} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold">Profit &amp; Loss</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{monthLabel(statement.month)}</p>

        {statement.transactionCount === 0 && (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            No customer payments captured yet this month — the statement below will fill in as orders come in.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-6">
          <Stat
            label="Net profit this month"
            value={money(currency, statement.netProfit)}
            detail="Net sales after Shopify's fees and refunds, minus product costs and operating expenses."
          />
          <Stat
            label="Set aside for tax"
            value={money(currency, statement.taxSetAside)}
            detail="An estimate based on the percentage set in Inputs — not tax advice."
          />
        </div>

        <dl className="mt-8 flex flex-col gap-2 text-sm">
          <StatementRow label="Revenue" value={statement.revenue} currency={currency} />
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
          {statement.adjustmentsAndReserves !== 0 && (
            <StatementRow label="Adjustments & reserves" value={statement.adjustmentsAndReserves} currency={currency} />
          )}

          <StatementRow label="Net profit" value={statement.netProfit} currency={currency} emphasis />
        </dl>

        {statement.pendingCashAmount !== 0 && (
          <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
            {money(currency, statement.pendingCashAmount)} of this month&apos;s revenue hasn&apos;t reached your bank yet — see
            Payouts.
          </p>
        )}
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
