import { db } from "@retransmit/db";
import { organization } from "@retransmit/db/schema/auth";
import { billingAccount } from "@retransmit/db/schema/billing";
import type { BillingStatus, PlanId } from "@retransmit/db/schema/billing";
import { eq } from "drizzle-orm";

import { PLANS, planFor } from "./plans";
import type { Plan } from "./plans";
import { requireStripe } from "./stripe";

export interface BillingAccount {
  organizationId: string;
  plan: Plan;
  status: BillingStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  hasPaymentMethod: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
}

/** Statuses in which the paid plan's entitlements still apply. */
const ENTITLED_STATUSES: BillingStatus[] = ["trialing", "active", "past_due"];

/**
 * The billing row for an organization, created on first read so that every
 * organization has one without a migration backfill or a signup hook.
 */
export async function getBillingAccount(organizationId: string): Promise<BillingAccount> {
  const [existing] = await db
    .select()
    .from(billingAccount)
    .where(eq(billingAccount.organizationId, organizationId));

  const row =
    existing ??
    (
      await db
        .insert(billingAccount)
        .values({ organizationId })
        .onConflictDoNothing()
        .returning()
    )[0] ??
    (
      await db
        .select()
        .from(billingAccount)
        .where(eq(billingAccount.organizationId, organizationId))
    )[0];

  if (!row) throw new Error(`Could not create a billing account for ${organizationId}`);

  return {
    organizationId: row.organizationId,
    // An unpaid or canceled subscription drops the organization back to Free
    // limits without touching the stored plan, so a reactivation restores it.
    plan: ENTITLED_STATUSES.includes(row.status) ? planFor(row.plan) : PLANS.free,
    status: row.status,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    hasPaymentMethod: row.hasPaymentMethod,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
  };
}

/** The plan an organization is entitled to right now. */
export async function getPlan(organizationId: string): Promise<Plan> {
  return (await getBillingAccount(organizationId)).plan;
}

/**
 * The period usage is counted in. A subscribed organization uses Stripe's own
 * period so the local counter and the invoice reset together; everyone else
 * uses the UTC calendar month.
 */
export function usagePeriodStart(account: BillingAccount, now = new Date()): Date {
  const start = account.currentPeriodStart;
  const end = account.currentPeriodEnd;
  if (start && (!end || end > now) && start <= now) return start;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function usagePeriodEnd(account: BillingAccount, now = new Date()): Date {
  const start = usagePeriodStart(account, now);
  if (account.currentPeriodEnd && account.currentPeriodStart?.getTime() === start.getTime()) {
    return account.currentPeriodEnd;
  }
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
}

/**
 * The organization's Stripe customer, created on first use. The organization id
 * goes in metadata so a customer found in the Stripe dashboard can be traced
 * back without a database lookup.
 */
export async function ensureStripeCustomer(organizationId: string): Promise<string> {
  const account = await getBillingAccount(organizationId);
  if (account.stripeCustomerId) return account.stripeCustomerId;

  const [org] = await db
    .select({ name: organization.name, slug: organization.slug })
    .from(organization)
    .where(eq(organization.id, organizationId));

  const customer = await requireStripe().customers.create({
    name: org?.name,
    metadata: { organizationId, organizationSlug: org?.slug ?? "" },
  });

  // Another request may have created one concurrently; the unique index makes
  // that a conflict, and whoever lost re-reads the winner.
  const [updated] = await db
    .update(billingAccount)
    .set({ stripeCustomerId: customer.id })
    .where(eq(billingAccount.organizationId, organizationId))
    .returning({ stripeCustomerId: billingAccount.stripeCustomerId });

  return updated?.stripeCustomerId ?? customer.id;
}

/** Applies a Stripe subscription's state to the local row. Used by the webhook. */
export async function saveSubscriptionState(
  organizationId: string,
  state: {
    plan?: PlanId;
    status: BillingStatus;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    hasPaymentMethod?: boolean;
    cancelAtPeriodEnd?: boolean;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
  },
): Promise<void> {
  await db
    .insert(billingAccount)
    .values({ organizationId, ...state })
    .onConflictDoUpdate({ target: billingAccount.organizationId, set: state });
}
