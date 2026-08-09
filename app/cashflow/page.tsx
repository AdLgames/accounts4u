import { formatDecimal } from "@/lib/money";
import { buildCashflow } from "@/lib/dashboard/cashflow";
import { resolveCurrentStore } from "@/lib/shopify/current-store";
import { AppNav } from "../_components/app-nav";
import { NotConnected } from "../_components/not-connected";
import { Stat } from "../_components/stat";
import { TrialBanner } from "../_components/trial-banner";
import { firstParam } from "../_lib/search-params";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthLabel(month: string): string {
  const [year, monthIndex] = month.split("-").map(Number);
  return `${MONTH_NAMES[monthIndex - 1]} ${year}`;
}

export default async function CashflowPage({ searchParams }: PageProps<"/cashflow">) {
  const params = await searchParams;
  const shop = firstParam(params.shop);
  const idToken = firstParam(params.id_token);

  const store = await resolveCurrentStore(shop, idToken);
  if (!store || !shop) {
    return <NotConnected />;
  }

  const statement = await buildCashflow(store.id);
  const currency = statement.currency ?? "";

  return (
    <div className="flex min-h-full flex-col">
      <AppNav shop={shop} current="/cashflow" />
      <TrialBanner shop={shop} trialEndsAt={store.trialEndsAt} subscriptionStatus={store.subscriptionStatus} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold">Cashflow</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{monthLabel(statement.month)}</p>

        <div className="mt-6 flex flex-col gap-6">
          <Stat
            label="Cash in"
            value={`${currency} ${formatDecimal(statement.cashIn)}`}
            detail={`${statement.transactionCount} transaction(s) captured this month.`}
          />
          <Stat
            label="Cash out"
            value={`${currency} ${formatDecimal(statement.cashOut)}`}
            detail={`${statement.billsPaidCount} bill(s) paid this month.`}
          />
          <Stat label="Net cash flow" value={`${currency} ${formatDecimal(statement.netCashFlow)}`} />
        </div>
      </main>
    </div>
  );
}
