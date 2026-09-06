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
 *    a two-step verification PIN. Skipped for numbers that came through the
 *    WhatsApp Business app path: the app already registered them and Meta
 *    rejects a second registration.
 * 4. `fetchPhoneNumber` — display number, verified name, quality rating.
 *
 * Numbers connected through the WhatsApp Business app (Meta's Coexistence
 * flow, https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/)
 * keep working in the app. The dialog returns only the WABA id for them, so
 * `listPhoneNumbers` finds the number, and `requestBusinessAppSync` asks
 * Meta to stream the app's contacts and message history to our webhook,
 * which Meta requires within 24 hours of onboarding.
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

/** One Graph API call with the usual auth, JSON and error handling. */
export async function graph<T>(
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

/**
 * Extends a short lived user token (the 24 hour one from App Dashboard →
 * API Setup) to a long lived one, about 60 days. Returns the input token
 * unchanged when Meta will not exchange it, e.g. a system user token that
 * never expires anyway.
 */
export async function extendUserToken(token: string): Promise<{ token: string; expiresIn: number | null }> {
  try {
    const body = await graph<{ access_token?: string; expires_in?: number }>("oauth/access_token", {
      query: {
        grant_type: "fb_exchange_token",
        client_id: process.env.WHATSAPP_META_APP_ID ?? "",
        client_secret: process.env.WHATSAPP_META_APP_SECRET ?? "",
        fb_exchange_token: token,
      },
    });
    if (!body.access_token) return { token, expiresIn: null };
    return { token: body.access_token, expiresIn: body.expires_in ?? null };
  } catch {
    return { token, expiresIn: null };
  }
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
  /** True when the number is also in use in the WhatsApp Business app. */
  isOnBusinessApp: boolean;
  /** CLOUD_API once Meta serves the number through the Cloud API. */
  platformType: string | null;
}

interface GraphPhoneNumber {
  id?: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
  is_on_biz_app?: boolean;
  platform_type?: string;
}

const PHONE_NUMBER_FIELDS =
  "id,display_phone_number,verified_name,quality_rating,code_verification_status,is_on_biz_app,platform_type";

function toPhoneNumber(body: GraphPhoneNumber): MetaPhoneNumber {
  if (!body.display_phone_number) throw new Error("Meta returned no display_phone_number");
  return {
    displayPhoneNumber: body.display_phone_number,
    verifiedName: body.verified_name ?? null,
    qualityRating: body.quality_rating ?? null,
    codeVerificationStatus: body.code_verification_status ?? null,
    isOnBusinessApp: body.is_on_biz_app === true,
    platformType: body.platform_type ?? null,
  };
}

export async function fetchPhoneNumber(phoneNumberId: string, token: string): Promise<MetaPhoneNumber> {
  const body = await graph<GraphPhoneNumber>(encodeURIComponent(phoneNumberId), {
    token,
    query: { fields: PHONE_NUMBER_FIELDS },
  });
  return toPhoneNumber(body);
}

/** Every number on a WABA, with the same fields as `fetchPhoneNumber`. */
export async function listPhoneNumbers(
  wabaId: string,
  token: string,
): Promise<(MetaPhoneNumber & { id: string })[]> {
  const body = await graph<{ data?: GraphPhoneNumber[] }>(`${encodeURIComponent(wabaId)}/phone_numbers`, {
    token,
    query: { fields: PHONE_NUMBER_FIELDS },
  });
  return (body.data ?? [])
    .filter((entry): entry is GraphPhoneNumber & { id: string } => Boolean(entry.id && entry.display_phone_number))
    .map((entry) => ({ id: entry.id, ...toPhoneNumber(entry) }));
}

export type BusinessAppSyncType = "smb_app_state_sync" | "history";

/**
 * Asks Meta to send a Business app number's contacts (`smb_app_state_sync`)
 * or up to six months of message history (`history`) to our webhook. Each
 * call returns a request id; the data arrives later as webhook
 * notifications on the field of the same name. A business can turn history
 * sharing off in the app, which Meta reports as error 2593109.
 */
export async function requestBusinessAppSync(
  phoneNumberId: string,
  token: string,
  syncType: BusinessAppSyncType,
): Promise<string | null> {
  const body = await graph<{ request_id?: string }>(`${encodeURIComponent(phoneNumberId)}/smb_app_data`, {
    method: "POST",
    token,
    body: JSON.stringify({ messaging_product: "whatsapp", sync_type: syncType }),
  });
  return body.request_id ?? null;
}

/** Six digits, as Meta requires for the two-step verification PIN. */
export function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
