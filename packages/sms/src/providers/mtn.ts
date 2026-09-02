import type { SmsMessage, SmsProvider, SmsSendResult } from "../provider";

/**
 * MTN MADAPI SMS v3 (https://developers.mtn.com/products/sms-v3-api).
 * One factory serves every MTN opco: credentials, sender id and short code
 * are approved per country on the MTN developer portal, so each opco is its
 * own provider instance with its own env prefix (MTN_CM, MTN_NG, ...).
 *
 * Env (per prefix): `<PREFIX>_CONSUMER_KEY`, `<PREFIX>_CONSUMER_SECRET`,
 * `<PREFIX>_SENDER_ADDRESS` (alphanumeric sender) and/or
 * `<PREFIX>_SERVICE_CODE` (approved short code), optional
 * `<PREFIX>_COST_PER_SMS` (USD) and `<PREFIX>_REQUEST_DLR` ("true" to ask
 * for delivery receipts — requires a registered subscription).
 */
export interface MtnProviderOptions {
  key: string;
  name: string;
  envPrefix: string;
  /** ISO countries this opco delivers to (normally exactly one). */
  countries: string[];
  /** Fallback cost when `<PREFIX>_COST_PER_SMS` is unset. */
  defaultCostUsd: number;
}

const DEFAULT_TOKEN_URL =
  "https://api.mtn.com/v1/oauth/access_token/accesstoken?grant_type=client_credentials";
const SEND_URL = "https://api.mtn.com/v3/sms/messages/sms/outbound";
const TOKEN_EXPIRY_SKEW_MS = 60_000;

interface MtnErrorBody {
  statusCode?: string;
  statusMessage?: string;
  supportMessage?: string;
  faultMessage?: string;
}

export function createMtnProvider(options: MtnProviderOptions): SmsProvider {
  const env = (suffix: string) => process.env[`${options.envPrefix}_${suffix}`];
  let cachedToken: { value: string; expiresAt: number } | undefined;

  async function getAccessToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

    const response = await fetch(process.env.MTN_TOKEN_URL ?? DEFAULT_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env("CONSUMER_KEY") ?? "",
        client_secret: env("CONSUMER_SECRET") ?? "",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: string | number;
    } & MtnErrorBody;
    if (!response.ok || !body.access_token) {
      throw new Error(
        `MTN OAuth failed (${response.status}): ${
          body.faultMessage ?? body.statusMessage ?? "no access_token in response"
        }`,
      );
    }

    const expiresInMs = Number(body.expires_in ?? 3600) * 1000;
    cachedToken = {
      value: body.access_token,
      expiresAt: Date.now() + Math.max(expiresInMs - TOKEN_EXPIRY_SKEW_MS, 30_000),
    };
    return cachedToken.value;
  }

  async function send(message: SmsMessage): Promise<SmsSendResult> {
    const senderAddress = message.from ?? env("SENDER_ADDRESS");
    // Per the MTN spec serviceCode is always required; when sending with an
    // alphanumeric senderAddress instead of a short code, the senderAddress
    // value must be repeated in serviceCode.
    const serviceCode = env("SERVICE_CODE") ?? senderAddress;
    if (!serviceCode) {
      throw new Error(
        `${options.name}: set ${options.envPrefix}_SENDER_ADDRESS or ${options.envPrefix}_SERVICE_CODE`,
      );
    }

    const token = await getAccessToken();
    const response = await fetch(SEND_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...(senderAddress ? { senderAddress } : {}),
        serviceCode,
        receiverAddress: message.to.map((to) => to.replace(/^\+/, "")),
        message: message.text,
        // Exactly fits MTN's 36-char limit: `sms_` + 32 hex chars.
        clientCorrelatorId: message.id,
        requestDeliveryReceipt: env("REQUEST_DLR") === "true",
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const body = (await response.json().catch(() => ({}))) as {
      transactionId?: string;
      data?: { status?: string };
    } & MtnErrorBody;
    if (!response.ok || (body.statusCode && body.statusCode !== "0000")) {
      throw new Error(
        `${options.name} send failed (${response.status}${
          body.statusCode ? `/${body.statusCode}` : ""
        }): ${body.supportMessage ?? body.statusMessage ?? body.faultMessage ?? "unknown error"}`,
      );
    }
    return { providerMessageId: body.transactionId };
  }

  return {
    key: options.key,
    name: options.name,
    isConfigured() {
      return Boolean(
        env("CONSUMER_KEY") &&
          env("CONSUMER_SECRET") &&
          (env("SENDER_ADDRESS") ?? env("SERVICE_CODE")),
      );
    },
    costFor(country) {
      if (!country || !options.countries.includes(country)) return null;
      const configured = Number(env("COST_PER_SMS"));
      return Number.isFinite(configured) && configured > 0 ? configured : options.defaultCostUsd;
    },
    send,
  };
}
