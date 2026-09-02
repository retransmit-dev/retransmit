import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { webhookDelivery, webhookEndpoint } from "@retransmit/db/schema/email";
import type { WebhookEventType } from "@retransmit/db/schema/email";
import { and, eq } from "drizzle-orm";

const DELIVERY_TIMEOUT_MS = 10_000;

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

/** Signature over `${timestamp}.${body}` with HMAC-SHA256, hex encoded. */
export function signWebhookPayload(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/** For consumers (and the future SDK) to verify a received webhook. */
export function verifyWebhookSignature(
  secret: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean {
  const expected = signWebhookPayload(secret, timestamp, body);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface EmailEventPayload {
  emailId: string;
  from: string;
  to: string[];
  subject: string;
  createdAt: string;
  data?: Record<string, unknown>;
}

/**
 * Delivers an email event to every enabled endpoint of the user that
 * subscribes to it. Failures are recorded on the delivery row and never
 * thrown — webhook problems must not fail the send or callback path.
 */
export async function dispatchEmailEvent(
  userId: string,
  type: WebhookEventType,
  payload: EmailEventPayload,
): Promise<void> {
  const endpoints = await db
    .select()
    .from(webhookEndpoint)
    .where(and(eq(webhookEndpoint.userId, userId), eq(webhookEndpoint.enabled, true)));

  const subscribed = endpoints.filter((endpoint) => endpoint.eventTypes.includes(type));
  if (subscribed.length === 0) return;

  const deliveryId = createId("whd");
  const body = JSON.stringify({ id: deliveryId, type, created_at: new Date().toISOString(), data: payload });

  await Promise.allSettled(subscribed.map((endpoint) => deliver(endpoint, type, body)));
}

async function deliver(
  endpoint: typeof webhookEndpoint.$inferSelect,
  type: WebhookEventType,
  body: string,
): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signWebhookPayload(endpoint.secret, timestamp, body);

  let responseStatus: number | null = null;
  let error: string | null = null;
  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "retransmit-timestamp": timestamp,
        "retransmit-signature": `v1=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    responseStatus = response.status;
    if (!response.ok) error = `Endpoint responded with ${response.status}`;
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }

  await db.insert(webhookDelivery).values({
    id: createId("whd"),
    endpointId: endpoint.id,
    eventType: type,
    payload: JSON.parse(body) as Record<string, unknown>,
    responseStatus,
    success: responseStatus !== null && responseStatus >= 200 && responseStatus < 300,
    error,
  });
}
