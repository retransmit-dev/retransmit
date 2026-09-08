import { randomBytes } from "node:crypto";

/**
 * Generates a prefixed, URL-safe identifier, e.g. `em_9f2c4b1a...`.
 * Prefixes in use: key (api key), dom (domain), em (email),
 * evt (email event), att (email attachment), wh (webhook endpoint), whd (webhook delivery),
 * org (organization), mem (member), sup (suppression), bt (email batch),
 * sms (sms message), sev (sms event), snd (sms sender id), wab (whatsapp
 * account), wa (whatsapp message), wae (whatsapp event), wai (whatsapp inbound
 * message), wat (whatsapp template).
 */
export function createId(prefix: string): string {
  return `${prefix}_${randomBytes(16).toString("hex")}`;
}
