import Stripe from "stripe";

import { isCloudMode } from "./mode";

/**
 * Stripe exists only in cloud mode. Self-hosted mode ignores Stripe credentials
 * even if they are present; cloud startup validates the required credentials.
 * Every caller goes through `getStripe()` and handles null, or through
 * `requireStripe()` when the operation is meaningless without it.
 */
let client: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (client === undefined) {
    if (!isCloudMode()) {
      client = null;
      return client;
    }
    const key = process.env.STRIPE_SECRET_KEY;
    client = key
      ? new Stripe(key, {
          // Pinned so a Stripe-side version rollout cannot change the shape of
          // a webhook payload under a running deploy.
          apiVersion: "2026-08-26.dahlia",
          appInfo: { name: "Retransmit", url: "https://retransmit.dev" },
        })
      : null;
  }
  return client;
}

export function requireStripe(): Stripe {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error(
      isCloudMode()
        ? "STRIPE_SECRET_KEY is not configured for this cloud deployment"
        : "Stripe billing is not available in self-hosted mode",
    );
  }
  return stripe;
}

export function isBillingConfigured(): boolean {
  return getStripe() !== null;
}

/**
 * Price ids are resolved from `lookup_key` rather than pinned in env, so
 * `infra/setup-stripe.sh` is the only place the catalog is described and test
 * and live accounts need no separate configuration. Prices are immutable and a
 * lookup key moves only when the script mints a replacement, so caching for the
 * life of the process is safe.
 */
const priceIds = new Map<string, string>();

export async function priceIdForLookupKey(lookupKey: string): Promise<string> {
  const cached = priceIds.get(lookupKey);
  if (cached) return cached;

  const stripe = requireStripe();
  const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const price = data[0];
  if (!price) {
    throw new Error(
      `No active Stripe price with lookup key "${lookupKey}". Run infra/setup-stripe.sh.`,
    );
  }
  priceIds.set(lookupKey, price.id);
  return price.id;
}

/** Resolves several lookup keys at once, keeping the result in input order. */
export async function priceIdsForLookupKeys(lookupKeys: string[]): Promise<string[]> {
  return Promise.all(lookupKeys.map(priceIdForLookupKey));
}
