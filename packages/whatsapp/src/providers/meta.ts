import type {
  WhatsappMessage,
  WhatsappProvider,
  WhatsappSender,
  WhatsappSendResult,
} from "../provider";

/**
 * Meta WhatsApp Business Platform, Cloud API
 * (https://developers.facebook.com/docs/whatsapp/cloud-api).
 *
 * Retransmit is the Meta app ("Tech Provider"); each customer connects their
 * own WhatsApp Business Account and phone number through Embedded Signup
 * (see ../meta-signup.ts). Sending uses that account's token and phone
 * number id, so nothing here is per-deployment except the app itself.
 *
 * App-level env (prefix `WHATSAPP_META`):
 * - `<PREFIX>_APP_ID` / `<PREFIX>_APP_SECRET` — the Meta app. The secret
 *   also signs webhook posts (verified in ../delivery.ts).
 * - `<PREFIX>_VERIFY_TOKEN` — webhook verification handshake.
 * - `<PREFIX>_SIGNUP_CONFIG_ID` — Embedded Signup configuration.
 * - `<PREFIX>_API_VERSION` — Graph API version, default `v23.0`.
 * - `<PREFIX>_COST_PER_MESSAGE` — optional USD price override.
 */
export interface MetaProviderOptions {
  key: string;
  name: string;
  envPrefix: string;
  /** Fallback cost when `<PREFIX>_COST_PER_MESSAGE` is unset. */
  defaultCostUsd: number;
}

// META_GRAPH_API_BASE_URL swaps the whole Graph host (local mock).
export const graphBaseUrl = () => process.env.META_GRAPH_API_BASE_URL ?? "https://graph.facebook.com";
export const metaApiVersion = () => process.env.WHATSAPP_META_API_VERSION ?? "v23.0";

/** Graph API error envelope. */
interface MetaErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_data?: { messaging_product?: string; details?: string };
    fbtrace_id?: string;
  };
}

export function describeMetaError(body: MetaErrorBody, status?: number): string {
  const error = body.error;
  if (!error) return status ? `HTTP ${status}` : "unknown error";
  const detail = error.error_data?.details;
  const code = [error.code, error.error_subcode].filter((part) => part !== undefined).join("/");
  return `${code ? `${code}: ` : ""}${error.message ?? "unknown error"}${detail ? ` (${detail})` : ""}`;
}

/** Cloud API `messages` request body for one of our outbound messages. */
export function buildMetaPayload(message: WhatsappMessage): Record<string, unknown> {
  const base = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    // Meta accepts E.164 with or without the `+`; the canonical form is digits only.
    to: message.to.replace(/^\+/, ""),
  };

  switch (message.type) {
    case "text":
      return {
        ...base,
        type: "text",
        text: { preview_url: message.previewUrl ?? false, body: message.text ?? "" },
      };
    case "template": {
      const template = message.template;
      if (!template) throw new Error("Template messages need a `template` object");
      return {
        ...base,
        type: "template",
        template: {
          name: template.name,
          language: { code: template.language },
          ...(template.components ? { components: template.components } : {}),
        },
      };
    }
    case "image":
    case "document": {
      const media = message.media;
      if (!media) throw new Error(`${message.type} messages need a \`${message.type}\` object`);
      return {
        ...base,
        type: message.type,
        [message.type]: {
          link: media.link,
          ...(media.caption ?? message.text ? { caption: media.caption ?? message.text } : {}),
          ...(message.type === "document" && media.filename ? { filename: media.filename } : {}),
        },
      };
    }
  }
}

export function createMetaProvider(options: MetaProviderOptions): WhatsappProvider {
  const env = (suffix: string) => process.env[`${options.envPrefix}_${suffix}`];

  async function send(message: WhatsappMessage, sender: WhatsappSender): Promise<WhatsappSendResult> {
    const url = `${graphBaseUrl()}/${metaApiVersion()}/${encodeURIComponent(sender.phoneNumberId)}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${sender.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(buildMetaPayload(message)),
      signal: AbortSignal.timeout(30_000),
    });

    const body = (await response.json().catch(() => ({}))) as {
      messages?: { id?: string; message_status?: string }[];
      contacts?: { input?: string; wa_id?: string }[];
    } & MetaErrorBody;
    if (!response.ok || body.error) {
      throw new Error(
        `${options.name} send failed (${response.status}): ${describeMetaError(body, response.status)}`,
      );
    }
    return { providerMessageId: body.messages?.[0]?.id };
  }

  return {
    key: options.key,
    name: options.name,
    isConfigured() {
      return Boolean(env("APP_ID") && env("APP_SECRET"));
    },
    costFor() {
      const configured = Number(env("COST_PER_MESSAGE"));
      return Number.isFinite(configured) && configured > 0 ? configured : options.defaultCostUsd;
    },
    send,
  };
}
