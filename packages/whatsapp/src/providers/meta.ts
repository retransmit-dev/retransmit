import type { WhatsappMessage, WhatsappProvider, WhatsappSendResult } from "../provider";

/**
 * Meta WhatsApp Business Platform, Cloud API
 * (https://developers.facebook.com/docs/whatsapp/cloud-api).
 *
 * Retransmit connects to Meta directly: one Meta app, one WhatsApp Business
 * Account (WABA) and one platform phone number carry every customer's
 * messages. Customers never see Meta.
 *
 * Env (per prefix, default `WHATSAPP_META`):
 * - `<PREFIX>_ACCESS_TOKEN` — a permanent System User token with
 *   `whatsapp_business_messaging` (and `whatsapp_business_management`).
 * - `<PREFIX>_PHONE_NUMBER_ID` — the sending number's id from WhatsApp
 *   Manager (not the number itself).
 * - `<PREFIX>_COST_PER_MESSAGE` — optional USD price override.
 * - `<PREFIX>_API_VERSION` — Graph API version, default `v23.0`.
 *
 * Webhooks (statuses and inbound messages) are verified and processed in
 * `../delivery.ts`; see `<PREFIX>_APP_SECRET` and `<PREFIX>_VERIFY_TOKEN`.
 */
export interface MetaProviderOptions {
  key: string;
  name: string;
  envPrefix: string;
  /** Fallback cost when `<PREFIX>_COST_PER_MESSAGE` is unset. */
  defaultCostUsd: number;
}

// META_GRAPH_API_BASE_URL swaps the whole Graph host (local mock).
const baseUrl = () => process.env.META_GRAPH_API_BASE_URL ?? "https://graph.facebook.com";

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
  const version = () => env("API_VERSION") ?? "v23.0";
  const sendUrl = () =>
    `${baseUrl()}/${version()}/${encodeURIComponent(env("PHONE_NUMBER_ID") ?? "")}/messages`;

  async function send(message: WhatsappMessage): Promise<WhatsappSendResult> {
    const response = await fetch(sendUrl(), {
      method: "POST",
      headers: {
        authorization: `Bearer ${env("ACCESS_TOKEN") ?? ""}`,
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
      return Boolean(env("ACCESS_TOKEN") && env("PHONE_NUMBER_ID"));
    },
    costFor() {
      const configured = Number(env("COST_PER_MESSAGE"));
      return Number.isFinite(configured) && configured > 0 ? configured : options.defaultCostUsd;
    },
    send,
  };
}
