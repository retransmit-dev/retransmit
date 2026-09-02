import { createHash, randomBytes } from "node:crypto";

export interface GeneratedApiKey {
  /** Full key, shown to the user exactly once. */
  key: string;
  /** SHA-256 hex digest, the only form persisted. */
  keyHash: string;
  /** Redacted form for display, e.g. `rt_1a2b…9f0e`. */
  keyHint: string;
}

export function generateApiKey(): GeneratedApiKey {
  const key = `rt_${randomBytes(24).toString("base64url")}`;
  return {
    key,
    keyHash: hashApiKey(key),
    keyHint: `${key.slice(0, 7)}…${key.slice(-4)}`,
  };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
