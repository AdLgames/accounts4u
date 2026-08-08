export interface TrialStatusInput {
  trialEndsAt: Date | null;
  subscriptionStatus: string;
}

/**
 * Trial/subscription gate: read-only once the 14-day trial has ended and
 * there's no active subscription. Deliberately doesn't delete anything on
 * expiry — PLAN.md is explicit that losing their data is the reason a
 * lapsed merchant comes back, not a reason to lose them for good.
 */
export function isReadOnly(store: TrialStatusInput): boolean {
  if (store.subscriptionStatus === "active") return false;
  if (!store.trialEndsAt) return false; // no trial end set (legacy row) -- don't lock out
  return store.trialEndsAt.getTime() < Date.now();
}

/** Whole days remaining in the trial, floored at 0. Null once subscribed (no trial to count down). */
export function daysLeftInTrial(store: TrialStatusInput, now = new Date()): number | null {
  if (store.subscriptionStatus === "active" || !store.trialEndsAt) return null;
  const msLeft = store.trialEndsAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
}
