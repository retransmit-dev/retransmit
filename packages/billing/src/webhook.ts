import type { BillingStatus, PlanId } from "@retransmit/db/schema/billing";
import type Stripe from "stripe";

import { saveSubscriptionState } from "./account";
import { isPlanId, planForLookupKey } from "./plans";
import { requireStripe } from "./stripe";

/**
 * Subscription state changes after checkout and outside any request: renewals,
 * failed payments, dunning, cancellations. Without this handler the dashboard
 * would show whatever was true the moment someone subscribed, so entitlements
 * are driven from here and nowhere else.
 */
export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
] as const;

export function constructEvent(payload: string | Buffer, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  return requireStripe().webhooks.constructEvent(payload, signature, secret);
}

/** Seconds since the epoch, as Stripe sends them. */
function toDate(seconds: number | null | undefined): Date | null {
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
}

/**
 * The organization a subscription belongs to. Checkout stamps it into
 * subscription metadata; the customer's metadata is the fallback for
 * subscriptions created by hand in the Stripe dashboard.
 */
async function organizationIdFor(subscription: Stripe.Subscription): Promise<string | null> {
  const fromSubscription = subscription.metadata?.organizationId;
  if (fromSubscription) return fromSubscription;

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const customer = await requireStripe().customers.retrieve(customerId);
  if (customer.deleted) return null;
  return customer.metadata?.organizationId ?? null;
}

/**
 * The plan a subscription is on, read from its own line items rather than its
 * metadata, so a change made in the Stripe dashboard is still reflected.
 */
function planForSubscription(subscription: Stripe.Subscription): PlanId | null {
  for (const item of subscription.items.data) {
    const plan = planForLookupKey(item.price.lookup_key);
    if (plan) return plan.id;
  }
  const fromMetadata = subscription.metadata?.plan;
  return fromMetadata && isPlanId(fromMetadata) ? fromMetadata : null;
}

async function applySubscription(subscription: Stripe.Subscription): Promise<void> {
  const organizationId = await organizationIdFor(subscription);
  if (!organizationId) {
    console.warn(`Stripe subscription ${subscription.id} has no organizationId; ignoring`);
    return;
  }

  const status = subscription.status as BillingStatus;
  const plan = planForSubscription(subscription);

  // Every item shares the subscription's period; the first one is enough.
  const item = subscription.items.data[0];

  await saveSubscriptionState(organizationId, {
    ...(plan ? { plan } : {}),
    status: status === "canceled" ? "canceled" : status,
    stripeCustomerId:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    stripeSubscriptionId: subscription.id,
    // A canceled subscription can no longer be charged, whatever is on file.
    hasPaymentMethod:
      status !== "canceled" &&
      status !== "incomplete_expired" &&
      Boolean(subscription.default_payment_method ?? subscription.default_source),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodStart: toDate(item?.current_period_start),
    currentPeriodEnd: toDate(item?.current_period_end),
  });
}

/**
 * Applies one verified Stripe event. Everything is a read of the subscription
 * as Stripe currently has it rather than a diff, so events arriving out of
 * order converge on the right state.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const stripe = requireStripe();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (!session.subscription) return;
      const id =
        typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      await applySubscription(await stripe.subscriptions.retrieve(id));
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      // Re-read rather than trusting the payload: the event may be stale by the
      // time it is delivered, and `default_payment_method` is not expanded here.
      await applySubscription(await stripe.subscriptions.retrieve(event.data.object.id));
      return;
    }

    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const line = invoice.lines.data.find((entry) => entry.subscription);
      const id =
        typeof line?.subscription === "string" ? line.subscription : (line?.subscription?.id ?? null);
      // The period moves on when an invoice is paid, so the usage counter has to
      // follow; a failure moves the subscription to past_due.
      if (id) await applySubscription(await stripe.subscriptions.retrieve(id));
      return;
    }

    default:
      return;
  }
}
