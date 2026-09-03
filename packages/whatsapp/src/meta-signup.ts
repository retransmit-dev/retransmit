import { describeMetaError, graphBaseUrl, metaApiVersion } from "./providers/meta";

/**
 * Server side of Meta's Embedded Signup
 * (https://developers.facebook.com/docs/whatsapp/embedded-signup).
 *
 * The dashboard opens Meta's signup dialog under Retransmit's app. The
 * customer picks or creates a business, creates a WhatsApp Business Account
 * (WABA) and verifies a phone number they own. The dialog returns a short
 * lived `code` plus the new `waba_id` / `phone_number_id`; the functions here
 * turn that into a working number:
 *
 * 1. `exchangeCode` — code → business integration token scoped to the
 *    customer's WABA (long lived, tied to our app).
 * 2. `subscribeApp` — subscribe our app to the WABA so its webhooks
 *    (statuses, inbound messages) reach /v1/callbacks/whatsapp/meta.
 * 3. `registerPhoneNumber` — register the number for Cloud API sending with
 *    a two-step verification PIN.
 * 4. `fetchPhoneNumber` — display number, verified name, quality rating.
 *
 * App-level env: WHATSAPP_META_APP_ID, WHATSAPP_META_APP_SECRET, and
 * WHATSAPP_META_SIGNUP_CONFIG_ID (the Embedded Signup configuration id shown
 * in App Dashboard → Facebook Login for Business → Configurations).
 */

export interface EmbeddedSignupConfig {
  appId: string;
  configId: string;
  apiVersion: string;
}

/** Null when the deployment has not been set up for Embedded Signup yet. */
export function embeddedSignupConfig(): EmbeddedSignupConfig | null {
  const appId = process.env.WHATSAPP_META_APP_ID;
  const configId = process.env.WHATSAPP_META_SIGNUP_CONFIG_ID;
  if (!appId || !configId || !process.env.WHATSAPP_META_APP_SECRET) return null;
  return { appId, configId, apiVersion: metaApiVersion() };
}

interface GraphError {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_data?: { details?: string };
  };
}

async function graph<T>(
  path: string,
  init: RequestInit & { token?: string; query?: Record<string, string> } = {},
): Promise<T> {
  const url = new URL(`${graphBaseUrl()}/${metaApiVersion()}/${path}`);
  for (const [name, value] of Object.entries(init.query ?? {})) url.searchParams.set(name, value);
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await response.json().catch(() => ({}))) as T & GraphError;
  if (!response.ok || body.error) {
    throw new Error(`Meta ${path} failed (${response.status}): ${describeMetaError(body, response.status)}`);
  }
  return body;
}

/** Exchanges the Embedded Signup code for the customer's business token. */
export async function exchangeCode(code: string): Promise<string> {
  const appId = process.env.WHATSAPP_META_APP_ID ?? "";
  const appSecret = process.env.WHATSAPP_META_APP_SECRET ?? "";
  const body = await graph<{ access_token?: string }>("oauth/access_token", {
    query: { client_id: appId, client_secret: appSecret, code },
  });
  if (!body.access_token) throw new Error("Meta returned no access token for the signup code");
  return body.access_token;
}

/** Subscribes Retransmit's app to the WABA's webhooks. Idempotent. */
export async function subscribeApp(wabaId: string, token: string): Promise<void> {
  await graph(`${encodeURIComponent(wabaId)}/subscribed_apps`, { method: "POST", token });
}

/** Removes the subscription; call when the last number on a WABA is disconnected. */
export async function unsubscribeApp(wabaId: string, token: string): Promise<void> {
  await graph(`${encodeURIComponent(wabaId)}/subscribed_apps`, { method: "DELETE", token });
}

/**
 * Registers the number for Cloud API sending. The PIN enables two-step
 * verification; the same PIN is required to re-register the number later.
 * Re-registering an already registered number with the same PIN is a no-op.
 */
export async function registerPhoneNumber(
  phoneNumberId: string,
  token: string,
  pin: string,
): Promise<void> {
  await graph(`${encodeURIComponent(phoneNumberId)}/register`, {
    method: "POST",
    token,
    body: JSON.stringify({ messaging_product: "whatsapp", pin }),
  });
}

export interface MetaPhoneNumber {
  displayPhoneNumber: string;
  verifiedName: string | null;
  qualityRating: string | null;
  /** VERIFIED once the customer completed SMS/voice verification. */
  codeVerificationStatus: string | null;
}

export async function fetchPhoneNumber(phoneNumberId: string, token: string): Promise<MetaPhoneNumber> {
  const body = await graph<{
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
    code_verification_status?: string;
  }>(encodeURIComponent(phoneNumberId), {
    token,
    query: { fields: "display_phone_number,verified_name,quality_rating,code_verification_status" },
  });
  if (!body.display_phone_number) throw new Error("Meta returned no display_phone_number");
  return {
    displayPhoneNumber: body.display_phone_number,
    verifiedName: body.verified_name ?? null,
    qualityRating: body.quality_rating ?? null,
    codeVerificationStatus: body.code_verification_status ?? null,
  };
}

/** Six digits, as Meta requires for the two-step verification PIN. */
export function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
