import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { daysLeftInTrial, isReadOnly } from "@/lib/billing/access";
import { formatDecimal, minorUnits, parseDecimal } from "@/lib/money";
import { listProductsFromOrders } from "@/lib/shopify/products-from-orders";
import { resolveCurrentStore } from "@/lib/shopify/current-store";
import { AppNav } from "../_components/app-nav";
import { NotConnected } from "../_components/not-connected";
import { TrialBanner } from "../_components/trial-banner";
import { firstParam } from "../_lib/search-params";

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const params = await searchParams;
  const shop = firstParam(params.shop);
  const idToken = firstParam(params.id_token);
  const saved = firstParam(params.saved) === "1";

  const store = await resolveCurrentStore(shop, idToken);
  if (!store || !shop) {
    return <NotConnected />;
  }
  // Fresh, definitely-non-null bindings for the server actions below —
  // narrowing from the guard above doesn't carry into nested function
  // declarations.
  const storeId = store.id;
  const shopParam = shop;
  // The real enforcement: server actions check this themselves rather than
  // trusting the UI to have disabled the form — a disabled button is just
  // a hint, not a guarantee, for anyone submitting the form directly.
  const readOnly = isReadOnly(store);
  const trialDaysLeft = daysLeftInTrial(store);

  const settings = await prisma.storeSettings.upsert({
    where: { storeId },
    create: { storeId },
    update: {},
  });

  const [productCosts, products] = await Promise.all([
    prisma.productCost.findMany({ where: { storeId } }),
    listProductsFromOrders(storeId),
  ]);
  const costByProductId = new Map(productCosts.map((cost) => [cost.shopifyProductId, cost.costPerUnit]));

  async function saveGeneralSettings(formData: FormData) {
    "use server";
    if (readOnly) {
      redirect(`/settings?shop=${encodeURIComponent(shopParam)}`);
    }

    const taxSetAsidePercent = Math.max(0, Math.min(100, Number(String(formData.get("taxSetAsidePercent") ?? "0")) || 0));
    const monthlyAdSpend = parseDecimal(String(formData.get("monthlyAdSpend") || "0"));
    const recurringExpenses = parseDecimal(String(formData.get("recurringExpenses") || "0"));

    await prisma.storeSettings.update({
      where: { storeId },
      data: { taxSetAsidePercent, monthlyAdSpend, recurringExpenses },
    });

    redirect(`/settings?shop=${encodeURIComponent(shopParam)}&saved=1`);
  }

  async function saveProductCost(formData: FormData) {
    "use server";
    if (readOnly) {
      redirect(`/settings?shop=${encodeURIComponent(shopParam)}`);
    }

    const productId = String(formData.get("productId"));
    const cost = parseDecimal(String(formData.get("cost") || "0"));

    await prisma.productCost.upsert({
      where: { storeId_shopifyProductId: { storeId, shopifyProductId: productId } },
      create: { storeId, shopifyProductId: productId, costPerUnit: cost },
      update: { costPerUnit: cost },
    });

    redirect(`/settings?shop=${encodeURIComponent(shopParam)}&saved=1`);
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppNav shop={shop} current="/settings" />
      <TrialBanner shop={shop} trialEndsAt={store.trialEndsAt} subscriptionStatus={store.subscriptionStatus} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        {saved && <p className="mt-2 text-sm text-green-700 dark:text-green-400">Saved.</p>}

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">General</h2>
          <form action={saveGeneralSettings} className="mt-3 flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Tax set-aside (% of net sales)
              <input
                type="number"
                name="taxSetAsidePercent"
                min={0}
                max={100}
                defaultValue={settings.taxSetAsidePercent}
                disabled={readOnly}
                className="rounded border border-black/15 px-3 py-2 disabled:opacity-50 dark:border-white/20 dark:bg-black"
              />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                An estimate to help you put money aside — not tax advice.
              </span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Monthly ad spend
              <input
                type="text"
                inputMode="decimal"
                name="monthlyAdSpend"
                defaultValue={formatDecimal(minorUnits(settings.monthlyAdSpend))}
                disabled={readOnly}
                className="rounded border border-black/15 px-3 py-2 disabled:opacity-50 dark:border-white/20 dark:bg-black"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Recurring expenses (rent, software, etc.)
              <input
                type="text"
                inputMode="decimal"
                name="recurringExpenses"
                defaultValue={formatDecimal(minorUnits(settings.recurringExpenses))}
                disabled={readOnly}
                className="rounded border border-black/15 px-3 py-2 disabled:opacity-50 dark:border-white/20 dark:bg-black"
              />
            </label>
            <button
              type="submit"
              disabled={readOnly}
              className="self-start rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              Save
            </button>
          </form>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Cost per product (COGS)</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Products seen in your recent orders. Set a cost so your true profit accounts for it.
          </p>
          {products.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              No products found yet — they show up here once orders have synced.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-black/10 dark:divide-white/10">
              {products.map((product) => (
                <li key={product.productId} className="flex items-center justify-between gap-4 py-2">
                  <span className="truncate text-sm">{product.title}</span>
                  <form action={saveProductCost} className="flex items-center gap-2">
                    <input type="hidden" name="productId" value={product.productId} />
                    <input
                      type="text"
                      inputMode="decimal"
                      name="cost"
                      defaultValue={
                        costByProductId.has(product.productId)
                          ? formatDecimal(minorUnits(costByProductId.get(product.productId)!))
                          : ""
                      }
                      placeholder="0.00"
                      disabled={readOnly}
                      className="w-24 rounded border border-black/15 px-2 py-1 text-sm disabled:opacity-50 dark:border-white/20 dark:bg-black"
                    />
                    <button
                      type="submit"
                      disabled={readOnly}
                      className="text-sm font-medium text-zinc-500 hover:text-zinc-800 disabled:opacity-50 dark:hover:text-zinc-200"
                    >
                      Save
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Billing</h2>
          <div className="mt-3 flex items-center justify-between gap-4 rounded border border-black/15 px-4 py-3 dark:border-white/20">
            <div className="text-sm">
              <p className="font-medium">
                {store.subscriptionStatus === "active"
                  ? "Active subscription"
                  : store.subscriptionStatus === "trialing"
                    ? `Free trial${trialDaysLeft !== null ? ` — ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left` : ""}`
                    : store.subscriptionStatus === "canceled"
                      ? "Subscription canceled"
                      : `Subscription: ${store.subscriptionStatus}`}
              </p>
              {readOnly && (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Your trial has ended. Subscribe to keep editing settings.
                </p>
              )}
            </div>
            {store.stripeCustomerId ? (
              <a
                href={`/api/stripe/portal?shop=${encodeURIComponent(shop)}`}
                className="shrink-0 rounded-full border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                Manage billing
              </a>
            ) : (
              <a
                href={`/api/stripe/checkout?shop=${encodeURIComponent(shop)}`}
                className="shrink-0 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
              >
                Subscribe
              </a>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
