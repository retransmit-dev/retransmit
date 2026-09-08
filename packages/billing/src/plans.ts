/**
 * The pricing table, in code. Everything that differs between Free, Pro and
 * Business is here, so a plan change is one edit in one file and the dashboard,
 * the API limits and the marketing page cannot drift apart.
 *
 * The Stripe half of the table (what a plan costs and what the overage rate is)
 * lives in Stripe as prices; `infra/setup-stripe.sh` creates them and this file
 * only records the lookup keys used to find them. The amounts below are
 * duplicated for display only — Stripe is what actually bills.
 */

import { PLAN_IDS } from "@retransmit/db/schema/billing";
import type { PlanId } from "@retransmit/db/schema/billing";

/** Cheapest first, so the dashboard and the pricing page order themselves. */
export const PLANS_ORDER = PLAN_IDS;
export type { PlanId };

export type SupportLevel = "community" | "standard" | "priority";

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly platform fee in cents, for display. Stripe holds the real price. */
  priceCents: number;
  /** Emails included in the platform fee each billing period. */
  includedEmails: number;
  /** Overage in cents per 1,000 emails beyond `includedEmails`, for display. */
  overageCentsPer1K: number;
  /** Verified sending domains an organization may hold at once. */
  domains: number;
  /** Members, counting the owner and any pending invitation. */
  teamMembers: number;
  /** How long emails, SMS and their events stay queryable. */
  logRetentionDays: number;
  support: SupportLevel;
  /** `lookup_key` of the flat monthly Stripe price. */
  platformLookupKey: string;
  /** `lookup_key` of the graduated metered email price for this plan. */
  emailLookupKey: string;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceCents: 0,
    includedEmails: 1_000,
    overageCentsPer1K: 25,
    domains: 1,
    teamMembers: 1,
    logRetentionDays: 1,
    support: "community",
    platformLookupKey: "plan_free_monthly",
    emailLookupKey: "email_free",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceCents: 3_900,
    includedEmails: 50_000,
    overageCentsPer1K: 18,
    domains: 10,
    teamMembers: 5,
    logRetentionDays: 30,
    support: "standard",
    platformLookupKey: "plan_pro_monthly",
    emailLookupKey: "email_pro",
  },
  business: {
    id: "business",
    name: "Business",
    priceCents: 9_900,
    includedEmails: 200_000,
    overageCentsPer1K: 16,
    domains: 50,
    teamMembers: 20,
    logRetentionDays: 90,
    support: "priority",
    platformLookupKey: "plan_business_monthly",
    emailLookupKey: "email_business",
  },
};

/** Lookup keys of the pay-as-you-go prices, shared by every plan. */
export const SMS_LOOKUP_KEY = "sms_usage";
export const WHATSAPP_LOOKUP_KEY = "whatsapp_usage";

export const PLAN_LIST: Plan[] = PLANS_ORDER.map((id) => PLANS[id]);

export function isPlanId(value: string): value is PlanId {
  return (PLANS_ORDER as readonly string[]).includes(value);
}

/** Falls back to Free for an unknown value, so a bad row never blocks a send. */
export function planFor(id: string | null | undefined): Plan {
  return id && isPlanId(id) ? PLANS[id] : PLANS.free;
}

/** The plan a Stripe price belongs to, by lookup key. Null if it is not a plan price. */
export function planForLookupKey(lookupKey: string | null | undefined): Plan | null {
  if (!lookupKey) return null;
  return (
    PLAN_LIST.find(
      (plan) => plan.platformLookupKey === lookupKey || plan.emailLookupKey === lookupKey,
    ) ?? null
  );
}
