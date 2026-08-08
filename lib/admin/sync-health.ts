// Cron sweep runs every 6h (vercel.json) — flag a store as stale once it's
// gone meaningfully longer than that without a sync, success or failure.
const STALE_AFTER_HOURS = 8;

export function isSyncStale(lastSyncAt: Date | null, now = new Date()): boolean {
  if (!lastSyncAt) return true;
  return lastSyncAt.getTime() < now.getTime() - STALE_AFTER_HOURS * 60 * 60 * 1000;
}
