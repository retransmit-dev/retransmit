import { randomBytes } from "node:crypto";

/**
 * Generates a prefixed, URL-safe identifier, e.g. `em_9f2c4b1a...`.
 * Prefixes in use: key (api key), dom (domain), em (email),
 * evt (email event), wh (webhook endpoint), whd (webhook delivery),
 * org (organization), mem (member), sup (suppression).
 */
export function createId(prefix: string): string {
  return `${prefix}_${randomBytes(16).toString("hex")}`;
}
