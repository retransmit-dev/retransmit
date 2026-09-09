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
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
  // A card added or replaced in the customer portal never touches the
  // subscription, so without these the dashboard would still say there is no
  // payment method after someone added one.
  "customer.updated",
  "payment_method.attached",
  "payment_method.detached",
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

/** The customer on a subscription, whether or not it came back expanded. */
async function customerFor(
  subscription: Stripe.Subscription,
): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
  if (typeof subscription.customer !== "string") return subscription.customer;
  return await requireStripe().customers.retrieve(subscription.customer);
}

/**
 * The organization a subscription belongs to. Checkout stamps it into
 * subscription metadata; the customer's metadata is the fallback for
 * subscriptions created by hand in the Stripe dashboard.
 */
function organizationIdFor(
  subscription: Stripe.Subscription,
  customer: Stripe.Customer | Stripe.DeletedCustomer,
): string | null {
  const fromSubscription = subscription.metadata?.organizationId;
  if (fromSubscription) return fromSubscription;
  if (customer.deleted) return null;
  return customer.metadata?.organizationId ?? null;
}

/**
 * Whether there is a card to charge. Checkout puts it on the subscription, the
 * customer portal puts it on the customer, and a subscription without its own
 * bills the customer's default — so either one counts. A canceled subscription
 * can no longer be charged whatever is on file.
 */
function hasChargeableMethod(
  subscription: Stripe.Subscription,
  customer: Stripe.Customer | Stripe.DeletedCustomer,
): boolean {
  if (subscription.status === "canceled" || subscription.status === "incomplete_expired") {
    return false;
  }
  if (subscription.default_payment_method ?? subscription.default_source) return true;
  if (customer.deleted) return false;
  return Boolean(customer.invoice_settings?.default_payment_method ?? customer.default_source);
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
  const customer = await customerFor(subscription);
  const organizationId = organizationIdFor(subscription, customer);
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
    status,
    stripeCustomerId: customer.id,
    stripeSubscriptionId: subscription.id,
    hasPaymentMethod: hasChargeableMethod(subscription, customer),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodStart: toDate(item?.current_period_start),
    currentPeriodEnd: toDate(item?.current_period_end),
  });
}

/** The subscription with its customer, which is where a portal card lands. */
async function readSubscription(id: string): Promise<Stripe.Subscription> {
  return await requireStripe().subscriptions.retrieve(id, { expand: ["customer"] });
}

/**
 * Re-reads every live subscription a customer has. Events about the customer
 * rather than a subscription — a card attached, a portal update — say nothing
 * about which subscription they affect, and the state we keep hangs off the
 * subscription.
 */
async function applyCustomer(customerId: string): Promise<void> {
  // The default listing leaves out canceled and incomplete_expired, which are
  // the ones a new card cannot revive anyway.
  const subscriptions = await requireStripe().subscriptions.list({
    customer: customerId,
    expand: ["data.customer"],
    limit: 10,
  });
  for (const subscription of subscriptions.data) await applySubscription(subscription);
}

/**
 * Applies one verified Stripe event. Everything is a read of the subscription
 * as Stripe currently has it rather than a diff, so events arriving out of
 * order converge on the right state.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (!session.subscription) return;
      const id =
        typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      await applySubscription(await readSubscription(id));
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      // Re-read rather than trusting the payload: the event may be stale by the
      // time it is delivered, and `default_payment_method` is not expanded here.
      await applySubscription(await readSubscription(event.data.object.id));
      return;
    }

    // Nothing here names a subscription, but all of them can change whether
    // there is a card to charge, which is what gates sending.
    case "customer.updated": {
      await applyCustomer(event.data.object.id);
      return;
    }

    case "payment_method.attached":
    case "payment_method.detached": {
      // Detaching leaves no customer on the payload; that case reaches us as a
      // `customer.updated` when the card was the default.
      const customer = event.data.object.customer;
      if (customer) {
        await applyCustomer(typeof customer === "string" ? customer : customer.id);
      }
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
      if (id) await applySubscription(await readSubscription(id));
      return;
    }

    default:
      return;
  }
}
