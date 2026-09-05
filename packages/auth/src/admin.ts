/**
 * Who may open the admin screen of the dashboard.
 *
 * There is no admin role in the database: the product has one operator, and
 * an allowlist of emails is simpler to reason about than a flag that could be
 * set by mistake. Every admin surface (the tRPC procedure, the page, the
 * sidebar row) asks this one function, so the list lives in one place.
 */

const ADMIN_EMAILS = new Set(["jpainam@gmail.com"]);

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.has(email.trim().toLowerCase());
}
