import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { email, emailEvent } from "@retransmit/db/schema/email";
import type { EmailStatus, WebhookEventType } from "@retransmit/db/schema/email";
import { dispatchEmailEvent } from "@retransmit/email/webhooks";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

export const callbackRoutes = new Hono();

interface SnsEnvelope {
  Type?: string;
  TopicArn?: string;
  SubscribeURL?: string;
  Message?: string;
}

/** SES event types (via configuration set → SNS) we translate into our model. */
const SES_EVENT_MAP: Record<string, { status: EmailStatus; webhook: WebhookEventType }> = {
  Delivery: { status: "delivered", webhook: "email.delivered" },
  Bounce: { status: "bounced", webhook: "email.bounced" },
  Complaint: { status: "complained", webhook: "email.complained" },
  Reject: { status: "rejected", webhook: "email.rejected" },
  "Rendering Failure": { status: "failed", webhook: "email.failed" },
};

/** Terminal statuses a late "Delivery"/"Send" event must not overwrite. */
const TERMINAL_STATUSES: EmailStatus[] = ["bounced", "complained", "rejected", "failed"];

/**
 * Receives SES event notifications through SNS (bounces, complaints,
 * deliveries). Point the SNS subscription for the configuration set's
 * event destination at `https://api.retransmit.dev/v1/callbacks/ses`.
 *
 * TODO: verify the SNS message signature (SigningCertURL) before launch;
 * for now we only check the topic ARN against SES_SNS_TOPIC_ARN.
 */
callbackRoutes.post("/ses", async (c) => {
  let envelope: SnsEnvelope;
  try {
    envelope = (await c.req.json()) as SnsEnvelope;
  } catch {
    return c.json({ error: { code: "invalid_json", message: "Body must be valid JSON" } }, 400);
  }

  const expectedTopic = process.env.SES_SNS_TOPIC_ARN;
  if (expectedTopic && envelope.TopicArn !== expectedTopic) {
    return c.json({ error: { code: "forbidden", message: "Unexpected topic" } }, 403);
  }

  if (envelope.Type === "SubscriptionConfirmation" && envelope.SubscribeURL) {
    const subscribeUrl = new URL(envelope.SubscribeURL);
    if (subscribeUrl.protocol !== "https:" || !subscribeUrl.hostname.endsWith(".amazonaws.com")) {
      return c.json({ error: { code: "forbidden", message: "Invalid subscribe URL" } }, 403);
    }
    await fetch(subscribeUrl);
    return c.json({ status: "subscription_confirmed" });
  }

  if (envelope.Type !== "Notification" || !envelope.Message) {
    return c.json({ status: "ignored" });
  }

  let sesEvent: {
    eventType?: string;
    notificationType?: string;
    mail?: { messageId?: string };
    [key: string]: unknown;
  };
  try {
    sesEvent = JSON.parse(envelope.Message);
  } catch {
    return c.json({ status: "ignored" });
  }

  const eventType = sesEvent.eventType ?? sesEvent.notificationType;
  const messageId = sesEvent.mail?.messageId;
  const mapping = eventType ? SES_EVENT_MAP[eventType] : undefined;
  if (!mapping || !messageId) {
    // Ack anything we don't handle (e.g. Send, Open) so SNS stops retrying.
    return c.json({ status: "ignored" });
  }

  const [row] = await db.select().from(email).where(eq(email.providerMessageId, messageId));
  if (!row) {
    return c.json({ status: "unknown_message" });
  }

  await db.insert(emailEvent).values({
    id: createId("evt"),
    emailId: row.id,
    type: mapping.webhook,
    data: sesEvent as Record<string, unknown>,
  });

  const overwrite =
    !TERMINAL_STATUSES.includes(row.status) || TERMINAL_STATUSES.includes(mapping.status);
  if (overwrite) {
    await db
      .update(email)
      .set({ status: mapping.status, lastEventAt: new Date() })
      .where(eq(email.id, row.id));
  }

  await dispatchEmailEvent(row.userId, mapping.webhook, {
    emailId: row.id,
    from: row.from,
    to: row.to,
    subject: row.subject,
    createdAt: row.createdAt.toISOString(),
    data: sesEvent as Record<string, unknown>,
  });

  return c.json({ status: "processed" });
});
