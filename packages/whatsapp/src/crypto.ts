import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Meta business tokens are long-lived bearer credentials for a customer's
 * WhatsApp Business Account, so they are encrypted at rest with
 * AES-256-GCM. The key is derived from WHATSAPP_TOKEN_ENCRYPTION_KEY, falling
 * back to BETTER_AUTH_SECRET so a fresh deployment works without another
 * secret. Rotating the key invalidates stored tokens; customers would need
 * to reconnect their numbers.
 */
function key(): Buffer {
  const secret = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY ?? process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("Set WHATSAPP_TOKEN_ENCRYPTION_KEY (or BETTER_AUTH_SECRET)");
  return createHash("sha256").update(secret).digest();
}

const VERSION = "v1";

/** `v1.<iv>.<tag>.<ciphertext>`, each part base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, encrypted].map((part) => (typeof part === "string" ? part : part.toString("base64url"))).join(".");
}

export function decryptSecret(stored: string): string {
  const [version, iv, tag, encrypted] = stored.split(".");
  if (version !== VERSION || !iv || !tag || !encrypted) {
    throw new Error("Stored secret is not in a recognized format");
  }
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
