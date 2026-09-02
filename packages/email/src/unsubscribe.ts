import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Unsubscribe links are `${baseUrl}/unsubscribe/${emailId}.${signature}`.
 * The signature is an HMAC over the email id, so the link proves the holder
 * received that exact email — nothing is stored per token and links cannot
 * be forged or enumerated.
 */

/** Placeholder senders put in their html/text body; replaced at send time. */
export const UNSUBSCRIBE_URL_PLACEHOLDER = "{{{unsubscribe_url}}}";

function unsubscribeSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("Set UNSUBSCRIBE_SECRET (or BETTER_AUTH_SECRET) to sign unsubscribe links");
  }
  return secret;
}

function sign(emailId: string): string {
  return createHmac("sha256", unsubscribeSecret()).update(emailId).digest("base64url");
}

export function unsubscribeToken(emailId: string): string {
  return `${emailId}.${sign(emailId)}`;
}

/** Returns the email id the token was issued for, or null if invalid. */
export function verifyUnsubscribeToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const emailId = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1), "base64url");
  const expected = Buffer.from(sign(emailId), "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected) ? emailId : null;
}

/** Public base under which the API serves GET/POST /unsubscribe/:token. */
export function unsubscribeBaseUrl(): string {
  return (process.env.UNSUBSCRIBE_BASE_URL ?? "https://api.retransmit.dev").replace(/\/$/, "");
}

export function unsubscribeUrl(emailId: string): string {
  return `${unsubscribeBaseUrl()}/unsubscribe/${unsubscribeToken(emailId)}`;
}
