import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { daysLeftInTrial, isReadOnly } from "@/lib/billing/access";
import { createBill, deleteBill, importBillsCsv, listBills, updateBill } from "@/lib/bills/db";
import { BILL_CATEGORIES, isBillCategory, type BillInput, type BillStatus } from "@/lib/bills/types";
import { loadShopifyProductTypes } from "@/lib/dashboard/product-lines";
import { formatDecimal, minorUnits, parseDecimal } from "@/lib/money";
import { listProductsFromOrders } from "@/lib/shopify/products-from-orders";
import { resolveCurrentStore } from "@/lib/shopify/current-store";
import { AppNav } from "../_components/app-nav";
import { LegalFooter } from "../_components/legal-footer";
import { NotConnected } from "../_components/not-connected";
import { RefreshStatus } from "../_components/refresh-status";
import { TrialBanner } from "../_components/trial-banner";
import { firstParam } from "../_lib/search-params";

function dateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

function parseDateInput(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export default async function InputsPage({ searchParams }: PageProps<"/inputs">) {
  const params = await searchParams;
  const shop = firstParam(params.shop);
  const idToken = firstParam(params.id_token);
  const saved = firstParam(params.saved) === "1";
  const billsImported = firstParam(params.billsImported);
  const billErrorsRaw = firstParam(params.billErrors);
  const billErrors: { row: number; message: string }[] = billErrorsRaw ? safeParseErrors(billErrorsRaw) : [];
  const refreshed = firstParam(params.refreshed);

  const store = await resolveCurrentStore(shop, idToken);
  if (!store || !shop) {
    return <NotConnected />;
  }
  const storeId = store.id;
  const shopParam = shop;
  const readOnly = isReadOnly(store);
  const trialDaysLeft = daysLeftInTrial(store);

  const settings = await prisma.storeSettings.upsert({ where: { storeId }, create: { storeId }, update: {} });

  const [productCosts, products, bills, shopifyProductTypes] = await Promise.all([
    prisma.productCost.findMany({ where: { storeId } }),
    listProductsFromOrders(storeId),
    listBills(storeId),
    loadShopifyProductTypes(storeId),
  ]);
  const costByProductId = new Map(productCosts.map((cost) => [cost.shopifyProductId, cost]));

  async function saveGeneralSettings(formData: FormData) {
    "use server";
    if (readOnly) redirect(`/inputs?shop=${encodeURIComponent(shopParam)}`);

    const taxSetAsidePercent = Math.max(0, Math.min(100, Number(String(formData.get("taxSetAsidePercent") ?? "0")) || 0));
    await prisma.storeSettings.update({ where: { storeId }, data: { taxSetAsidePercent } });

    redirect(`/inputs?shop=${encodeURIComponent(shopParam)}&saved=1`);
  }

  async function saveProductCost(formData: FormData) {
    "use server";
    if (readOnly) redirect(`/inputs?shop=${encodeURIComponent(shopParam)}`);

    const productId = String(formData.get("productId"));
    const cost = parseDecimal(String(formData.get("cost") || "0"));
    // Freeform, not a fixed pick-list — mirrors Shopify's own product_type
    // field. Empty means "no override", so P&L falls back to the Shopify
    // type synced for this product (see product-lines.ts).
    const revenueCategory = String(formData.get("revenueCategory") ?? "").trim() || null;

    await prisma.productCost.upsert({
      where: { storeId_shopifyProductId: { storeId, shopifyProductId: productId } },
      create: { storeId, shopifyProductId: productId, costPerUnit: cost, revenueCategory },
      update: { costPerUnit: cost, revenueCategory },
    });

    redirect(`/inputs?shop=${encodeURIComponent(shopParam)}&saved=1`);
  }

  function billInputFromForm(formData: FormData): BillInput {
    const vendor = String(formData.get("vendor") ?? "").trim();
    const categoryRaw = String(formData.get("category") ?? "");
    if (!isBillCategory(categoryRaw)) {
      throw new TypeError(`Unknown category "${categoryRaw}"`);
    }
    const amount = parseDecimal(String(formData.get("amount") || "0"));
    const incurredOn = parseDateInput(String(formData.get("incurredOn") ?? ""));
    const statusRaw = String(formData.get("status") ?? "unpaid");
    const status: BillStatus = statusRaw === "paid" ? "paid" : "unpaid";
    // Normalize rather than reject: leaving a stray paid-date filled in
    // after switching a dropdown back to "unpaid" is an honest mistake, not
    // an error worth blocking the form over.
    const paidOnRaw = String(formData.get("paidOn") ?? "");
    const paidOn = status === "paid" ? (paidOnRaw ? parseDateInput(paidOnRaw) : new Date()) : null;

    return { vendor, category: categoryRaw, amount, incurredOn, status, paidOn, notes: null };
  }

  async function createBillAction(formData: FormData) {
    "use server";
    if (readOnly) redirect(`/inputs?shop=${encodeURIComponent(shopParam)}`);

    await createBill(storeId, billInputFromForm(formData));
    redirect(`/inputs?shop=${encodeURIComponent(shopParam)}&saved=1`);
  }

  async function updateBillAction(formData: FormData) {
    "use server";
    if (readOnly) redirect(`/inputs?shop=${encodeURIComponent(shopParam)}`);

    const billId = String(formData.get("billId"));
    await updateBill(storeId, billId, billInputFromForm(formData));
    redirect(`/inputs?shop=${encodeURIComponent(shopParam)}&saved=1`);
  }

  async function deleteBillAction(formData: FormData) {
    "use server";
    if (readOnly) redirect(`/inputs?shop=${encodeURIComponent(shopParam)}`);

    const billId = String(formData.get("billId"));
    await deleteBill(storeId, billId);
    redirect(`/inputs?shop=${encodeURIComponent(shopParam)}&saved=1`);
  }

  async function importBillsCsvAction(formData: FormData) {
    "use server";
    if (readOnly) redirect(`/inputs?shop=${encodeURIComponent(shopParam)}`);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      redirect(`/inputs?shop=${encodeURIComponent(shopParam)}`);
    }
    const csvText = await file.text();
    const { imported, errors } = await importBillsCsv(storeId, csvText);

    const errorsParam = encodeURIComponent(JSON.stringify(errors.slice(0, 20)));
    redirect(`/inputs?shop=${encodeURIComponent(shopParam)}&billsImported=${imported}&billErrors=${errorsParam}`);
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppNav shop={shop} current="/inputs" />
      <RefreshStatus status={refreshed} />
      <TrialBanner shop={shop} trialEndsAt={store.trialEndsAt} subscriptionStatus={store.subscriptionStatus} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold">Inputs</h1>
        {saved && <p className="mt-2 text-sm text-green-700 dark:text-green-400">Saved.</p>}
        {billsImported !== undefined && (
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">Imported {billsImported} bill(s).</p>
        )}
        {billErrors.length > 0 && (
          <div className="mt-2 rounded border border-amber-400/50 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <p className="font-medium">{billErrors.length} row(s) had errors and weren&apos;t imported:</p>
            <ul className="mt-1 list-disc pl-4">
              {billErrors.map((error) => (
                <li key={error.row}>
                  Row {error.row}: {error.message}
                </li>
              ))}
            </ul>
          </div>
        )}

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
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Bills &amp; expenses</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Feeds Operating Expenses on P&amp;L and Cash Out on Cashflow, both once a bill is marked paid (cash basis — the
            default for most small businesses; unpaid bills still show as a liability on Balance Sheet). Shopify&apos;s own
            Bill Pay has no way for this app to read from it, so bills are entered here directly.
          </p>

          {bills.length > 0 && (
            <ul className="mt-4 flex flex-col divide-y divide-black/10 dark:divide-white/10">
              {bills.map((bill) => (
                <li key={bill.id} className="py-3">
                  <form action={updateBillAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="billId" value={bill.id} />
                    <BillFields
                      readOnly={readOnly}
                      defaults={{
                        vendor: bill.vendor,
                        category: bill.category,
                        amount: formatDecimal(minorUnits(bill.amount)),
                        incurredOn: dateInputValue(bill.incurredOn),
                        status: bill.status as BillStatus,
                        paidOn: dateInputValue(bill.paidOn),
                      }}
                    />
                    <button
                      type="submit"
                      disabled={readOnly}
                      className="rounded-full border border-black/15 px-3 py-2 text-xs font-medium disabled:opacity-50 dark:border-white/20"
                    >
                      Save
                    </button>
                  </form>
                  <form action={deleteBillAction} className="mt-1">
                    <input type="hidden" name="billId" value={bill.id} />
                    <button
                      type="submit"
                      disabled={readOnly}
                      className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 rounded border border-black/15 px-4 py-4 dark:border-white/20">
            <p className="text-sm font-medium">Add a bill</p>
            <form action={createBillAction} className="mt-3 flex flex-wrap items-end gap-2">
              <BillFields readOnly={readOnly} defaults={null} />
              <button
                type="submit"
                disabled={readOnly}
                className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background disabled:opacity-50"
              >
                Add bill
              </button>
            </form>
          </div>

          <div className="mt-4 rounded border border-black/15 px-4 py-4 dark:border-white/20">
            <p className="text-sm font-medium">Import from CSV</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Columns: <code>incurred_date,vendor,category,amount,status,paid_date</code> — dates as YYYY-MM-DD, status is
              &quot;paid&quot; or &quot;unpaid&quot;, paid_date required only when status is paid.
            </p>
            <form action={importBillsCsvAction} className="mt-3 flex items-center gap-2">
              <input type="file" name="file" accept=".csv,text/csv" required disabled={readOnly} className="text-sm" />
              <button
                type="submit"
                disabled={readOnly}
                className="shrink-0 rounded-full border border-black/15 px-4 py-2 text-xs font-medium disabled:opacity-50 dark:border-white/20"
              >
                Import
              </button>
            </form>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Cost &amp; revenue category per product</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Products seen in your recent orders. Set a cost so your true profit accounts for it. Revenue category
            defaults to the product type already set in Shopify, so you don&apos;t have to categorize twice — type
            something here only to override it for P&amp;L.
          </p>
          {products.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              No products found yet — they show up here once orders have synced.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-black/10 dark:divide-white/10">
              {products.map((product) => {
                const existing = costByProductId.get(product.productId);
                const shopifyType = shopifyProductTypes.get(product.productId) ?? null;
                return (
                  <li key={product.productId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="truncate text-sm">{product.title}</span>
                    <form action={saveProductCost} className="flex items-center gap-2">
                      <input type="hidden" name="productId" value={product.productId} />
                      <input
                        type="text"
                        inputMode="decimal"
                        name="cost"
                        defaultValue={existing ? formatDecimal(minorUnits(existing.costPerUnit)) : ""}
                        placeholder="0.00"
                        disabled={readOnly}
                        className="w-20 rounded border border-black/15 px-2 py-1 text-sm disabled:opacity-50 dark:border-white/20 dark:bg-black"
                      />
                      <input
                        type="text"
                        name="revenueCategory"
                        defaultValue={existing?.revenueCategory ?? ""}
                        placeholder={shopifyType ?? "Uncategorized"}
                        disabled={readOnly}
                        className="w-36 rounded border border-black/15 px-2 py-1 text-sm disabled:opacity-50 dark:border-white/20 dark:bg-black"
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
                );
              })}
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
                  Your trial has ended. Subscribe to keep editing inputs.
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
      <LegalFooter />
    </div>
  );
}

function BillFields({
  readOnly,
  defaults,
}: {
  readOnly: boolean;
  defaults: {
    vendor: string;
    category: string;
    amount: string;
    incurredOn: string;
    status: BillStatus;
    paidOn: string;
  } | null;
}) {
  const inputClass = "rounded border border-black/15 px-2 py-1 text-xs disabled:opacity-50 dark:border-white/20 dark:bg-black";
  return (
    <>
      <input
        type="text"
        name="vendor"
        placeholder="Vendor"
        defaultValue={defaults?.vendor}
        disabled={readOnly}
        required
        className={`${inputClass} w-32`}
      />
      <select name="category" defaultValue={defaults?.category ?? BILL_CATEGORIES[0]} disabled={readOnly} className={inputClass}>
        {BILL_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
      <input
        type="text"
        inputMode="decimal"
        name="amount"
        placeholder="0.00"
        defaultValue={defaults?.amount}
        disabled={readOnly}
        required
        className={`${inputClass} w-20`}
      />
      <label className="flex flex-col text-[10px] text-zinc-500 dark:text-zinc-400">
        Incurred
        <input type="date" name="incurredOn" defaultValue={defaults?.incurredOn} disabled={readOnly} required className={inputClass} />
      </label>
      <select name="status" defaultValue={defaults?.status ?? "unpaid"} disabled={readOnly} className={inputClass}>
        <option value="unpaid">Unpaid</option>
        <option value="paid">Paid</option>
      </select>
      <label className="flex flex-col text-[10px] text-zinc-500 dark:text-zinc-400">
        Paid date
        <input type="date" name="paidOn" defaultValue={defaults?.paidOn} disabled={readOnly} className={inputClass} />
      </label>
    </>
  );
}

function safeParseErrors(raw: string): { row: number; message: string }[] {
  // `raw` is already URL-decoded by the time it reaches searchParams —
  // Next.js decodes query values before this component sees them.
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as { row: number; message: string }[]) : [];
  } catch {
    return [];
  }
}
