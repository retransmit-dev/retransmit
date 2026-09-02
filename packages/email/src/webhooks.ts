import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { webhookDelivery, webhookEndpoint } from "@retransmit/db/schema/email";
import type { WebhookEventType } from "@retransmit/db/schema/email";
import { enqueueWebhookDispatch } from "@retransmit/queue";
import type { WebhookDispatchJob } from "@retransmit/queue";
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
 * Fans an event out as one `webhook-dispatch` job per subscribed endpoint.
 * Channel-agnostic: email and SMS events share the endpoint table and the
 * dispatch queue. Delivery happens in the worker with retries and a
 * dead-letter queue; this never blocks or fails the caller beyond the
 * enqueue itself.
 */
export async function dispatchWebhookEvent(
  userId: string,
  type: WebhookEventType,
  payload: Record<string, unknown>,
): Promise<void> {
  const endpoints = await db
    .select({ id: webhookEndpoint.id, eventTypes: webhookEndpoint.eventTypes })
    .from(webhookEndpoint)
    .where(and(eq(webhookEndpoint.userId, userId), eq(webhookEndpoint.enabled, true)));

  const subscribed = endpoints.filter((endpoint) => endpoint.eventTypes.includes(type));
  if (subscribed.length === 0) return;

  const body = JSON.stringify({
    id: createId("whd"),
    type,
    created_at: new Date().toISOString(),
    data: payload,
  });

  await enqueueWebhookDispatch(
    subscribed.map((endpoint) => ({ endpointId: endpoint.id, eventType: type, body })),
  );
}

export async function dispatchEmailEvent(
  userId: string,
  type: WebhookEventType,
  payload: EmailEventPayload,
): Promise<void> {
  await dispatchWebhookEvent(userId, type, payload as unknown as Record<string, unknown>);
}

/**
 * Delivers one webhook job to its endpoint (run by the worker). Every attempt
 * is recorded as a `webhook_delivery` row. Throws on failure so pg-boss
 * retries with backoff and eventually dead-letters the job.
 */
export async function deliverWebhookJob(job: WebhookDispatchJob): Promise<void> {
  const [endpoint] = await db
    .select()
    .from(webhookEndpoint)
    .where(eq(webhookEndpoint.id, job.endpointId));
  // Endpoint deleted or disabled since the event was enqueued: drop silently.
  if (!endpoint || !endpoint.enabled) return;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signWebhookPayload(endpoint.secret, timestamp, job.body);

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
      body: job.body,
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
    eventType: job.eventType as WebhookEventType,
    payload: JSON.parse(job.body) as Record<string, unknown>,
    responseStatus,
    success: responseStatus !== null && responseStatus >= 200 && responseStatus < 300,
    error,
  });

  if (error) throw new Error(`Webhook delivery to ${endpoint.url} failed: ${error}`);
}
