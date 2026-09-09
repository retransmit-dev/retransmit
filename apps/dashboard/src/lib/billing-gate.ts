/**
 * The billing dialog raised from outside the React tree.
 *
 * A mutation that fails on a billing check is caught in `createQueryClient`'s
 * mutation cache, which has no component to hold state in, so the pending
 * request lives here instead. `BillingGateDialog` is the only subscriber.
 *
 * `kind` is what would fix it. A limit the plan does not cover wants the plans;
 * work that would bill an organization with no card on file wants the card, and
 * showing it plans instead would send it round a loop that changes nothing.
 */
export type BillingGate = {
  kind: "upgrade" | "payment_method";
  /** What was refused, in the words the failed check used. */
  message: string;
};

let gate: BillingGate | null = null;
const listeners = new Set<() => void>();

/** Opens the billing dialog. A null gate closes it. */
export function requestBillingGate(next: BillingGate | null): void {
  gate = next;
  for (const listener of listeners) listener();
}

/**
 * The two halves of `useSyncExternalStore`, for `BillingGateDialog` to read.
 * The hook itself stays in that component: this module is reachable from server
 * components through the query client, which cannot import React hooks.
 */
export function subscribeToBillingGate(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getBillingGate(): BillingGate | null {
  return gate;
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
 * Which dialog an error should open, or null if it should stay a toast. tRPC
 * puts the failed check on `data.limit` (see the error formatter in
 * `@retransmit/api`): `payment_method_required` needs a card, `upgrade` needs a
 * bigger plan, and a failure that is neither keeps its toast because nothing in
 * either dialog would help.
 */
export function billingGateFor(error: unknown): BillingGate | null {
  if (error instanceof LimitReachedError) {
    return { kind: "upgrade", message: error.message };
  }
  const limit = (
    error as {
      data?: { limit?: { code: string; message: string; upgrade: boolean } | null };
    }
  )?.data?.limit;
  if (!limit) return null;
  if (limit.code === "payment_method_required") {
    return { kind: "payment_method", message: limit.message };
  }
  return limit.upgrade ? { kind: "upgrade", message: limit.message } : null;
}
