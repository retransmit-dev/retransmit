import type Stripe from "stripe";

import { ensureStripeCustomer, getBillingAccount } from "./account";
import { PLANS, SMS_LOOKUP_KEY, WHATSAPP_LOOKUP_KEY } from "./plans";
import type { PlanId } from "./plans";
import { priceIdsForLookupKeys, requireStripe } from "./stripe";

/**
 * Every subscription carries the same four items: the plan's flat price, the
 * plan's graduated email price, and the two pay-as-you-go meters. The metered
 * items cost nothing until they are used, so adding them up front means a first
 * SMS never has to modify the subscription mid-period.
 */
async function lineItemsFor(plan: PlanId): Promise<{ price: string; quantity?: number }[]> {
  const [platform, ...metered] = await priceIdsForLookupKeys([
    PLANS[plan].platformLookupKey,
    PLANS[plan].emailLookupKey,
    SMS_LOOKUP_KEY,
    WHATSAPP_LOOKUP_KEY,
  ]);
  if (!platform) throw new Error(`No Stripe price for the ${plan} plan`);
  // Only the flat price is licensed and takes a quantity; a metered price is
  // rejected if one is sent.
  return [{ price: platform, quantity: 1 }, ...metered.map((price) => ({ price }))];
}

/** Tags Checkout Sessions so flows can be compared in the Stripe dashboard. */
const INTEGRATION_IDENTIFIER = "rtmplanx";

/**
 * Starts a Checkout Session for an organization's first subscription. Used for
 * Free too: a Free organization that wants overage, SMS or WhatsApp goes
 * through Checkout to put a card on file, and the $0 plan price means the
 * session collects nothing up front.
 */
export async function createCheckoutSession(input: {
  organizationId: string;
  plan: PlanId;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const stripe = requireStripe();
  const customer = await ensureStripeCustomer(input.organizationId);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: await lineItemsFor(input.plan),
    // No payment_method_types: Stripe picks the eligible methods from the
    // dashboard configuration, which is what keeps conversion up.
    integration_identifier: INTEGRATION_IDENTIFIER,
    // A $0 Free subscription still needs a card, otherwise the metered items
    // have nothing to bill against.
    payment_method_collection: "always",
    client_reference_id: input.organizationId,
    subscription_data: { metadata: { organizationId: input.organizationId, plan: input.plan } },
    metadata: { organizationId: input.organizationId, plan: input.plan },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    // Off until a tax registration exists — see infra/setup-stripe.sh. Turning
    // it on without one silently collects nothing.
    automatic_tax: { enabled: false },
  });

  if (!session.url) throw new Error("Stripe returned a Checkout Session with no URL");
  return session.url;
}

/**
 * Moves an existing subscription to another plan, swapping both the flat price
 * and the email price in one call. Doing it here rather than in the customer
 * portal is deliberate: a portal configuration only accepts licensed prices, so
 * it would change the flat price and leave the old email allowance behind.
 */
export async function changePlan(organizationId: string, plan: PlanId): Promise<void> {
  const stripe = requireStripe();
  const account = await getBillingAccount(organizationId);
  if (!account.stripeSubscriptionId) {
    throw new Error("This organization has no subscription to change");
  }

  const subscription = await stripe.subscriptions.retrieve(account.stripeSubscriptionId, {
    expand: ["items.data.price"],
  });
  const wanted = await lineItemsFor(plan);
  const wantedIds = new Set(wanted.map((item) => item.price));

  const items: Stripe.SubscriptionUpdateParams.Item[] = [];
  for (const item of subscription.items.data) {
    if (wantedIds.has(item.price.id)) {
      wantedIds.delete(item.price.id);
      continue;
    }
    // A price that is not part of the new plan is one of the plan prices for
    // the old one; drop it. The metered items are shared and never land here.
    items.push({ id: item.id, deleted: true });
  }
  for (const item of wanted) {
    if (!wantedIds.has(item.price)) continue;
    items.push({ price: item.price, ...(item.quantity ? { quantity: item.quantity } : {}) });
  }

  if (items.length === 0) return;

  await stripe.subscriptions.update(account.stripeSubscriptionId, {
    items,
    // Bill the difference now rather than at renewal, so an upgrade takes
    // effect and is paid for at the same moment.
    proration_behavior: "create_prorations",
    cancel_at_period_end: false,
    metadata: { organizationId, plan },
  });
}

/** Customer portal for cards, invoices, tax ids and cancellation. */
export async function createPortalSession(
  organizationId: string,
  returnUrl: string,
): Promise<string> {
  const stripe = requireStripe();
  const customer = await ensureStripeCustomer(organizationId);
  const session = await stripe.billingPortal.sessions.create({
    customer,
    return_url: returnUrl,
  });
  return session.url;
}
