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
