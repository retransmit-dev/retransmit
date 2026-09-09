/**
 * The plan dialog raised from outside the React tree.
 *
 * A mutation that fails on a plan limit is caught in `createQueryClient`'s
 * mutation cache, which has no component to hold state in, so the pending
 * request lives here instead. `UpgradeDialog` is the only subscriber, and the
 * reason is the message the failed check wrote.
 */
let reason: string | null = null;
const listeners = new Set<() => void>();

/** Opens the plan dialog. A null reason closes it. */
export function requestUpgrade(next: string | null): void {
  reason = next;
  for (const listener of listeners) listener();
}

/**
 * The two halves of `useSyncExternalStore`, for `UpgradeDialog` to read. The
 * hook itself stays in that component: this module is reachable from server
 * components through the query client, which cannot import React hooks.
 */
export function subscribeToUpgrade(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getUpgradeReason(): string | null {
  return reason;
}

/**
 * An error a plan limit caused, for the calls that do not go through tRPC and
 * so cannot carry the failure in their error shape. better-auth's invitation
 * hook is the only one.
 */
export class LimitReachedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LimitReachedError";
  }
}

/**
 * Why an error should open the plan dialog, or null if it should stay a toast.
 * tRPC puts the failed check on `data.limit` (see the error formatter in
 * `@retransmit/api`); `upgrade` is false when a bigger plan would not help, and
 * those keep their toast.
 */
export function upgradeReasonFor(error: unknown): string | null {
  if (error instanceof LimitReachedError) return error.message;
  const limit = (error as { data?: { limit?: { message: string; upgrade: boolean } | null } })
    ?.data?.limit;
  return limit?.upgrade ? limit.message : null;
}
