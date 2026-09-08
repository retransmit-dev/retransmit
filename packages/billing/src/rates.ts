/**
 * Turning a message into billable units.
 *
 * SMS and WhatsApp cost different amounts per destination country, and a Stripe
 * price cannot vary by destination, so the `retransmit_sms` and
 * `retransmit_whatsapp` meters carry money instead of messages: one unit is USD
 * 0.0001, and the price charges 0.01 cents per unit. The rate card therefore
 * lives here, where it can be per country, and Stripe still does the rating.
 *
 * Email needs none of this — it is one unit per recipient and the plan's
 * graduated price holds the allowance and the overage rate.
 */

/** How many meter units make one US dollar. */
export const UNITS_PER_USD = 10_000;

/** Cents, for display. Rounds to the nearest cent the way an invoice would. */
export function unitsToCents(units: number): number {
  return Math.round((units / UNITS_PER_USD) * 100);
}

export function usdToUnits(usd: number): number {
  return Math.round(usd * UNITS_PER_USD);
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Multiple applied to the provider's own cost to get the customer price.
 * Retransmit's SMS providers quote per country (see `costFor` in
 * `@retransmit/sms`), so the markup is the only number that has to be chosen
 * here rather than looked up.
 */
function smsMargin(): number {
  return envNumber("SMS_PRICE_MARGIN", 1.6);
}

/** Charged when a provider quotes no price for a destination it still accepts. */
function smsFallbackUsd(): number {
  return envNumber("SMS_PRICE_FALLBACK_USD", 0.05);
}

/**
 * Billable units for one SMS. `providerCostUsd` is what the carrier charges
 * Retransmit per segment; `segments` is how many parts the text was split into.
 */
export function smsUnits(providerCostUsd: number | null, segments: number): number {
  const perSegment = providerCostUsd && providerCostUsd > 0 ? providerCostUsd : smsFallbackUsd();
  return usdToUnits(perSegment * smsMargin() * Math.max(1, segments));
}

/**
 * Billable units for one WhatsApp message. Meta prices per 24-hour conversation
 * by category and country and does not expose that table over an API, so this
 * is a single configurable rate until a per-country card is imported.
 */
export function whatsappUnits(messages = 1): number {
  return usdToUnits(envNumber("WHATSAPP_PRICE_USD", 0.02) * Math.max(1, messages));
}
