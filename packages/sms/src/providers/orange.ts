import type { SmsMessage, SmsProvider, SmsSendResult } from "../provider";

/**
 * Orange SMS API for Africa & Middle East
 * (https://developer.orange.com/apis/sms/getting-started).
 *
 * One Orange developer app carries bundles ("contracts") for several
 * countries, so credentials are app-wide while the sender number, sender name
 * and price are per country. Each country is its own provider instance with
 * its own env prefix (ORANGE_CM, ORANGE_CI, ...).
 *
 * Env:
 * - `ORANGE_CLIENT_ID` / `ORANGE_CLIENT_SECRET` — app credentials shared by
 *   every Orange country. `<PREFIX>_CLIENT_ID` / `<PREFIX>_CLIENT_SECRET`
 *   override them for one country. The secret may be the raw secret or the
 *   full `Basic <base64>` authorization header the portal prints.
 * - `<PREFIX>_SENDER_ADDRESS` — the country sender number from the Orange
 *   docs table (`+2370000` for Cameroon); the short code shown on the device
 *   is assigned by Orange, not chosen here.
 * - `<PREFIX>_SENDER_NAME` — optional custom sender name (max 11 alphanumeric
 *   chars). Must be approved by Orange first, otherwise sends fail with 400.
 * - `<PREFIX>_COST_PER_SMS` — USD price per segment, overrides the default.
 *
 * Delivery receipts: Orange posts `deliveryInfoNotification` to the callback
 * URL configured in the portal ("Configure Callback"), where `callbackData`
 * is the resource id we store as `providerMessageId`.
 */
export interface OrangeProviderOptions {
  key: string;
  name: string;
  envPrefix: string;
  /** ISO countries this contract delivers to (normally exactly one). */
  countries: string[];
  /** Country sender number from the Orange docs when `<PREFIX>_SENDER_ADDRESS` is unset. */
  defaultSenderAddress: string;
  /** Fallback cost when `<PREFIX>_COST_PER_SMS` is unset. */
  defaultCostUsd: number;
}

// ORANGE_API_BASE_URL swaps the host (local mock); ORANGE_TOKEN_URL only the token endpoint.
const baseUrl = () => process.env.ORANGE_API_BASE_URL ?? "https://api.orange.com";
const tokenUrl = () => process.env.ORANGE_TOKEN_URL ?? `${baseUrl()}/oauth/v3/token`;
const sendUrl = (senderAddress: string) =>
  `${baseUrl()}/smsmessaging/v1/outbound/${encodeURIComponent(`tel:${senderAddress}`)}/requests`;
const TOKEN_EXPIRY_SKEW_MS = 60_000;
/** Orange's "Expired credentials" code: drop the cached token and retry once. */
const EXPIRED_CREDENTIALS_CODE = 42;

/** Access tokens are per app, so instances sharing credentials share a token. */
const tokenCache = new Map<string, { value: string; expiresAt: number }>();

interface OrangeOAuthError {
  code?: number;
  message?: string;
  description?: string;
}

/** 4xx body on the messaging endpoints (OMA RESTful SMS API shape). */
interface OrangeRequestError {
  requestError?: {
    serviceException?: { messageId?: string; text?: string; variables?: string[] };
    policyException?: { messageId?: string; text?: string; variables?: string[] };
  };
}

function describeError(body: OrangeRequestError & OrangeOAuthError): string {
  const exception = body.requestError?.serviceException ?? body.requestError?.policyException;
  if (exception) {
    const text = (exception.text ?? "").replace(/%(\d+)/g, (_, index) => {
      return exception.variables?.[Number(index) - 1] ?? `%${index}`;
    });
    return `${exception.messageId ?? "error"}: ${text || "unknown error"}`;
  }
  if (body.message) return body.description ? `${body.message} (${body.description})` : body.message;
  return "unknown error";
}

/** Builds the `Basic` header from either a raw secret or a pasted header. */
function basicAuthorization(clientId: string, clientSecret: string): string {
  if (/^Basic\s+/i.test(clientSecret)) return `Basic ${clientSecret.replace(/^Basic\s+/i, "")}`;
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

/** Fetches (or reuses) an app access token for the given Basic header. */
export async function getOrangeAccessToken(authorization: string): Promise<string> {
  const cached = tokenCache.get(authorization);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const response = await fetch(tokenUrl(), {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: string | number;
  } & OrangeOAuthError;
  if (!response.ok || !body.access_token) {
    throw new Error(
      `Orange OAuth failed (${response.status}): ${
        body.access_token ? describeError(body) : (body.message ?? "no access_token in response")
      }`,
    );
  }

  const expiresInMs = Number(body.expires_in ?? 3600) * 1000;
  tokenCache.set(authorization, {
    value: body.access_token,
    expiresAt: Date.now() + Math.max(expiresInMs - TOKEN_EXPIRY_SKEW_MS, 30_000),
  });
  return body.access_token;
}

/** Resource id (UUID) from a `resourceURL` or `Location` value. */
function resourceIdFrom(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const id = url.split("/").filter(Boolean).at(-1);
  return id ? decodeURIComponent(id) : undefined;
}

export function createOrangeProvider(options: OrangeProviderOptions): SmsProvider {
  const env = (suffix: string) =>
    process.env[`${options.envPrefix}_${suffix}`] ?? process.env[`ORANGE_${suffix}`];
  const authorization = () => basicAuthorization(env("CLIENT_ID") ?? "", env("CLIENT_SECRET") ?? "");
  const senderAddress = () =>
    (process.env[`${options.envPrefix}_SENDER_ADDRESS`] ?? options.defaultSenderAddress).replace(
      /^tel:/,
      "",
    );

  async function sendOne(to: string, message: SmsMessage, retried = false): Promise<string | undefined> {
    const auth = authorization();
    const token = await getOrangeAccessToken(auth);
    const senderName = message.from ?? process.env[`${options.envPrefix}_SENDER_NAME`];

    const response = await fetch(sendUrl(senderAddress()), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        outboundSMSMessageRequest: {
          address: `tel:${to}`,
          senderAddress: `tel:${senderAddress()}`,
          ...(senderName ? { senderName } : {}),
          outboundSMSTextMessage: { message: message.text },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const body = (await response.json().catch(() => ({}))) as {
      outboundSMSMessageRequest?: { resourceURL?: string };
    } & OrangeRequestError &
      OrangeOAuthError;

    if (response.status === 401 && body.code === EXPIRED_CREDENTIALS_CODE && !retried) {
      tokenCache.delete(auth);
      return sendOne(to, message, true);
    }
    if (!response.ok) {
      throw new Error(`${options.name} send failed (${response.status}): ${describeError(body)}`);
    }
    return (
      resourceIdFrom(body.outboundSMSMessageRequest?.resourceURL) ??
      resourceIdFrom(response.headers.get("location"))
    );
  }

  async function send(message: SmsMessage): Promise<SmsSendResult> {
    // The documented request takes a single `address`, so multi-recipient
    // messages go out as one request per number. Ids are stored joined so a
    // delivery receipt for any of them still finds the row.
    const ids: string[] = [];
    for (const to of message.to) {
      const id = await sendOne(to, message);
      if (id) ids.push(id);
    }
    return { providerMessageId: ids.length ? ids.join(",") : undefined };
  }

  return {
    key: options.key,
    name: options.name,
    isConfigured() {
      return Boolean(env("CLIENT_ID") && env("CLIENT_SECRET"));
    },
    costFor(country) {
      if (!country || !options.countries.includes(country)) return null;
      const configured = Number(process.env[`${options.envPrefix}_COST_PER_SMS`]);
      return Number.isFinite(configured) && configured > 0 ? configured : options.defaultCostUsd;
    },
    send,
  };
}
