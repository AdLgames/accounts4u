import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isSyncStale } from "@/lib/admin/sync-health";
import { firstParam } from "../../_lib/search-params";

// Internal-only (PLAN.md Phase 5: "a simple admin page showing sync health
// per store"). Gated by a shared-secret query param rather than a login
// system — there's exactly one operator (the founder), so a real auth
// system would be effort spent on nothing.

export default async function AdminHealthPage({ searchParams }: PageProps<"/admin/health">) {
  const params = await searchParams;
  const token = firstParam(params.token);
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || token !== adminSecret) {
    notFound();
  }

  const stores = await prisma.store.findMany({
    orderBy: { installedAt: "desc" },
    select: {
      id: true,
      shopDomain: true,
      installedAt: true,
      webhooksRegisteredAt: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      lastSyncAt: true,
      lastSyncError: true,
    },
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 font-mono text-sm">
      <h1 className="text-xl font-semibold">Sync health</h1>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {stores.length} connected store{stores.length === 1 ? "" : "s"}. Cron sweep runs every 6h.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-black/15 text-xs text-zinc-500 dark:border-white/20 dark:text-zinc-400">
              <th className="py-2 pr-4">Shop</th>
              <th className="py-2 pr-4">Installed</th>
              <th className="py-2 pr-4">Webhooks</th>
              <th className="py-2 pr-4">Billing</th>
              <th className="py-2 pr-4">Last sync</th>
              <th className="py-2">Last error</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => {
              const isStale = isSyncStale(store.lastSyncAt);
              const hasError = Boolean(store.lastSyncError);
              return (
                <tr key={store.id} className="border-b border-black/10 align-top dark:border-white/10">
                  <td className="py-2 pr-4">{store.shopDomain}</td>
                  <td className="py-2 pr-4 text-zinc-500 dark:text-zinc-400">{store.installedAt.toISOString()}</td>
                  <td className="py-2 pr-4">
                    {store.webhooksRegisteredAt ? (
                      <span className="text-green-700 dark:text-green-400">registered</span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">not registered</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {store.subscriptionStatus}
                    {store.trialEndsAt && store.subscriptionStatus === "trialing" && (
                      <span className="text-zinc-500 dark:text-zinc-400"> (trial ends {store.trialEndsAt.toISOString().slice(0, 10)})</span>
                    )}
                  </td>
                  <td className={`py-2 pr-4 ${isStale ? "text-amber-700 dark:text-amber-400" : ""}`}>
                    {store.lastSyncAt ? store.lastSyncAt.toISOString() : "never"}
                    {isStale && " ⚠"}
                  </td>
                  <td className={`py-2 max-w-xs truncate ${hasError ? "text-red-700 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"}`}>
                    {store.lastSyncError ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
