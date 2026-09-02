import { ensureOrganizationForUser } from "@retransmit/auth/organization";
import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { email, emailEvent, suppression } from "@retransmit/db/schema/email";
import type { EmailStatus, SuppressionReason, WebhookEventType } from "@retransmit/db/schema/email";
import { extractEmailAddress } from "@retransmit/email/address";
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
  DeliveryDelay: { status: "delivery_delayed", webhook: "email.delivery_delayed" },
  Open: { status: "opened", webhook: "email.opened" },
  Click: { status: "clicked", webhook: "email.clicked" },
  Bounce: { status: "bounced", webhook: "email.bounced" },
  Complaint: { status: "complained", webhook: "email.complained" },
  Reject: { status: "rejected", webhook: "email.rejected" },
  "Rendering Failure": { status: "failed", webhook: "email.failed" },
};

/**
 * Events can arrive out of order; a status only moves forward. Statuses of
 * equal or higher rank win, and the terminal ranks (>= 80) always beat the
 * progression ranks.
 */
const STATUS_RANK: Record<EmailStatus, number> = {
  queued: 0,
  scheduled: 5,
  sent: 10,
  delivery_delayed: 20,
  delivered: 30,
  opened: 40,
  clicked: 50,
  canceled: 80,
  suppressed: 80,
  rejected: 80,
  failed: 80,
  bounced: 80,
  complained: 90,
};

/**
 * Adds the affected recipients to the organization's suppression list.
 * Hard (permanent) bounces and complaints only; transient bounces are just
 * status updates.
 */
async function recordSuppressions(
  row: typeof email.$inferSelect,
  sesEvent: Record<string, unknown>,
  eventType: string,
): Promise<void> {
  let reason: SuppressionReason;
  let recipients: unknown;
  if (eventType === "Bounce") {
    const bounce = sesEvent.bounce as
      | { bounceType?: string; bouncedRecipients?: { emailAddress?: string }[] }
      | undefined;
    if (bounce?.bounceType !== "Permanent") return;
    reason = "bounce";
    recipients = bounce.bouncedRecipients;
  } else {
    const complaint = sesEvent.complaint as
      | { complainedRecipients?: { emailAddress?: string }[] }
      | undefined;
    reason = "complaint";
    recipients = complaint?.complainedRecipients;
  }

  const fromEvent = Array.isArray(recipients)
    ? (recipients as { emailAddress?: string }[])
        .map((recipient) => recipient.emailAddress)
        .filter((address): address is string => typeof address === "string")
    : [];
  const addresses = [
    ...new Set(
      (fromEvent.length > 0 ? fromEvent : row.to)
        .map((value) => extractEmailAddress(value)?.toLowerCase())
        .filter((address): address is string => Boolean(address)),
    ),
  ];
  if (addresses.length === 0) return;

  // Emails sent before organizations existed carry no organizationId.
  const organizationId =
    row.organizationId ?? (await ensureOrganizationForUser(row.userId)).id;

  await db
    .insert(suppression)
    .values(
      addresses.map((address) => ({
        id: createId("sup"),
        organizationId,
        email: address,
        reason,
        sourceEmailId: row.id,
      })),
    )
    .onConflictDoNothing({ target: [suppression.organizationId, suppression.email] });
}

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

  if (eventType === "Bounce" || eventType === "Complaint") {
    await recordSuppressions(row, sesEvent as Record<string, unknown>, eventType);
  }

  if (STATUS_RANK[mapping.status] >= STATUS_RANK[row.status]) {
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
