/** Feedback after clicking AppNav's "Refresh" button — see app/api/shopify/refresh/route.ts. */
export function RefreshStatus({ status }: { status?: string }) {
  if (status === "synced") {
    return <p className="px-4 pt-2 text-xs text-green-700 dark:text-green-400">Refreshed with the latest from Shopify.</p>;
  }
  if (status === "cooldown") {
    return (
      <p className="px-4 pt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Already refreshed recently — try again in a minute or two.
      </p>
    );
  }
  if (status === "error") {
    return (
      <p className="px-4 pt-2 text-xs text-red-700 dark:text-red-400">Refresh failed — check the admin health page for details.</p>
    );
  }
  return null;
}
