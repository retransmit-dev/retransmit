import { describeMetaError, graphBaseUrl, metaApiVersion } from "./providers/meta";

/**
 * One-off sends against Meta's Cloud API, outside the account/queue path.
 *
 * Meta's App Review asks for a screen recording of a message leaving our UI
 * and landing in WhatsApp. That has to happen before the app has advanced
 * access, so it runs on the sandbox Meta hands every app: a test phone
 * number, a phone number id and a short-lived user token. None of that is a
 * connected `whatsapp_account`, hence this small side door.
 *
 * Defaults come from env so the dashboard form opens prefilled:
 * - `WHATSAPP_META_TEST_PHONE_NUMBER_ID` — the sandbox number's id.
 * - `WHATSAPP_META_TEST_ACCESS_TOKEN` — bearer token; never sent to the
 *   browser, the form only learns whether one is set.
 * - `WHATSAPP_META_TEST_RECIPIENT` — a number verified as a test recipient.
 */
export interface TestSendConfig {
  phoneNumberId: string;
  recipient: string;
  hasAccessToken: boolean;
  apiVersion: string;
}

export function testSendConfig(): TestSendConfig {
  return {
    phoneNumberId: process.env.WHATSAPP_META_TEST_PHONE_NUMBER_ID ?? "",
    recipient: process.env.WHATSAPP_META_TEST_RECIPIENT ?? "",
    hasAccessToken: Boolean(process.env.WHATSAPP_META_TEST_ACCESS_TOKEN),
    apiVersion: metaApiVersion(),
  };
}

export type TestMessage =
  | { type: "text"; body: string; previewUrl?: boolean }
  | {
      type: "template";
      name: string;
      language: string;
      /** Body `{{n}}` placeholders, in order. */
      bodyParameters: string[];
    };

export interface TestSendInput {
  phoneNumberId: string;
  /** Falls back to `WHATSAPP_META_TEST_ACCESS_TOKEN` when empty. */
  accessToken?: string;
  to: string;
  message: TestMessage;
}

export interface TestSendResult {
  ok: boolean;
  status: number;
  url: string;
  request: Record<string, unknown>;
  response: unknown;
  messageId?: string;
  error?: string;
}

export function buildTestPayload(to: string, message: TestMessage): Record<string, unknown> {
  const base = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to.replace(/[^\d]/g, ""),
  };
  if (message.type === "text") {
    return {
      ...base,
      type: "text",
      text: { preview_url: message.previewUrl ?? false, body: message.body },
    };
  }
  const parameters = message.bodyParameters.map((text) => ({ type: "text", text }));
  return {
    ...base,
    type: "template",
    template: {
      name: message.name,
      language: { code: message.language },
      ...(parameters.length > 0 ? { components: [{ type: "body", parameters }] } : {}),
    },
  };
}

export async function sendTestMessage(input: TestSendInput): Promise<TestSendResult> {
  const accessToken = input.accessToken?.trim() || process.env.WHATSAPP_META_TEST_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("No access token. Paste one or set WHATSAPP_META_TEST_ACCESS_TOKEN.");
  }

  const url = `${graphBaseUrl()}/${metaApiVersion()}/${encodeURIComponent(input.phoneNumberId)}/messages`;
  const request = buildTestPayload(input.to, input.message);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(30_000),
  });

  const body = (await response.json().catch(() => ({}))) as {
    messages?: { id?: string }[];
    error?: Record<string, unknown>;
  };
  const ok = response.ok && !body.error;

  return {
    ok,
    status: response.status,
    url,
    request,
    response: body,
    messageId: body.messages?.[0]?.id,
    error: ok ? undefined : describeMetaError(body, response.status),
  };
}
