/** "$39" / "$0.18" — whole dollars stay whole, cents get two places. */
export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** "50,000" — thousands separators for volumes. */
export function formatCount(value: number): string {
  return value.toLocaleString();
}

/** Micros in one US dollar, as `@retransmit/billing` stores rate-card prices. */
export const MICROS_PER_USD = 1_000_000;

/**
 * A rate-card price, in dollars. Four decimals because that is the finest the
 * Stripe meter can express, and rates run from $0.0042 to $0.59 a segment.
 */
export function formatMicros(micros: number): string {
  return (micros / MICROS_PER_USD).toFixed(4);
}
