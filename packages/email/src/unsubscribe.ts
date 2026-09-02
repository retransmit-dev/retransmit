import { createHash, createHmac, timingSafeEqual } from "node:crypto";

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

/**
 * Bidpilot-era outreach links carry a random 64-hex token instead of a signed
 * one. Emails imported by scripts/import-bidpilot.ts (apps/api) get their id
 * derived from that token, so the token alone locates the row — an id for a
 * token that was never imported simply matches nothing. Remove once
 * app.captivaq.com stops forwarding /unsubscribe/:token here.
 */
const LEGACY_TOKEN_REGEX = /^[0-9a-f]{64}$/;

export function legacyEmailIdForToken(token: string): string | null {
  if (!LEGACY_TOKEN_REGEX.test(token)) return null;
  return `em_leg_${createHash("sha256").update(token).digest("hex").slice(0, 32)}`;
}

/** Public base under which the API serves GET/POST /unsubscribe/:token. */
export function unsubscribeBaseUrl(): string {
  return (process.env.UNSUBSCRIBE_BASE_URL ?? "https://api.retransmit.dev").replace(/\/$/, "");
}

export function unsubscribeUrl(emailId: string): string {
  return `${unsubscribeBaseUrl()}/unsubscribe/${unsubscribeToken(emailId)}`;
}
