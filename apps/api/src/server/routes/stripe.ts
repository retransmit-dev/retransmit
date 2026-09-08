import { constructEvent, handleStripeEvent, isBillingConfigured } from "@retransmit/billing";
import { Hono } from "hono";

export const stripeRoutes = new Hono();

/**
 * Stripe's webhook. Subscription state changes asynchronously — renewals,
 * dunning, cancellations, a card that finally clears — so this is the only
 * thing that keeps an organization's entitlements true after checkout.
 *
 * The signature is checked against the raw body before anything is parsed, so
 * an unsigned request never reaches the handler.
 */
stripeRoutes.post("/", async (c) => {
  if (!isBillingConfigured()) {
    return c.json({ error: { code: "not_configured", message: "Billing is not configured" } }, 503);
  }

  const signature = c.req.header("stripe-signature");
  if (!signature) {
    return c.json(
      { error: { code: "unauthorized", message: "Missing Stripe-Signature header" } },
      400,
    );
  }

  let event;
  try {
    event = constructEvent(await c.req.text(), signature);
  } catch (error) {
    console.error("Rejected a Stripe webhook", error);
    return c.json({ error: { code: "invalid_signature", message: "Invalid signature" } }, 400);
  }

  try {
    await handleStripeEvent(event);
  } catch (error) {
    // A 500 makes Stripe retry, which is what we want for a transient failure.
    console.error(`Failed to handle Stripe event ${event.type} (${event.id})`, error);
    return c.json({ error: { code: "internal_error", message: "Could not handle event" } }, 500);
  }

  return c.json({ received: true });
});
