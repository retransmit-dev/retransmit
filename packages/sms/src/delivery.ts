import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { sms, smsEvent } from "@retransmit/db/schema/sms";
import type { SmsStatus } from "@retransmit/db/schema/sms";
import type { WebhookEventType } from "@retransmit/db/schema/email";
import { dispatchWebhookEvent } from "@retransmit/email/webhooks";
import { eq, like, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import z from "zod";

interface MappedStatus {
  status: SmsStatus;
  webhook: WebhookEventType;
}

/** Receipts can arrive out of order; a status only moves forward. */
const STATUS_RANK: Record<SmsStatus, number> = {
  queued: 0,
  sent: 10,
  delivered: 30,
  undelivered: 80,
  expired: 80,
  rejected: 80,
  failed: 80,
};

/**
 * Moves one message to a terminal delivery state, records the raw receipt as
 * an event and fans it out to the user's webhooks. Rows that are not found or
 * already past `mapped.status` are left alone (`applied: false`).
 */
async function applyDeliveryStatus(
  where: SQL,
  mapped: MappedStatus,
  raw: Record<string, unknown>,
  deliveryStatus: string,
): Promise<{ applied: boolean }> {
  const [row] = await db.select().from(sms).where(where);
  if (!row) return { applied: false };
  if (STATUS_RANK[mapped.status] <= STATUS_RANK[row.status]) return { applied: false };

  await db
    .update(sms)
    .set({ status: mapped.status, lastEventAt: new Date() })
    .where(eq(sms.id, row.id));
  await db.insert(smsEvent).values({
    id: createId("sev"),
    smsId: row.id,
    type: mapped.webhook,
    data: raw,
  });
  await dispatchWebhookEvent(row.userId, mapped.webhook, {
    smsId: row.id,
    from: row.from,
    to: row.to,
    country: row.country,
    provider: row.provider,
    segments: row.segments,
    createdAt: row.createdAt.toISOString(),
    data: { deliveryStatus },
  });
  return { applied: true };
}

// ---------------------------------------------------------------------------
// MTN

/**
 * MTN delivery receipt (DeliveryNotificationRequest). `clientCorrelatorId`
 * echoes the id we sent, which is our row id.
 */
const mtnNotificationSchema = z
  .object({
    clientCorrelatorId: z.string().min(1),
    deliveryStatus: z.string().min(1),
  })
  .loose();

/** SMPP-style delivery states → our status + webhook event. */
const MTN_STATUS_MAP: Record<string, MappedStatus> = {
  DELIVERED: { status: "delivered", webhook: "sms.delivered" },
  UNDELIVERED: { status: "undelivered", webhook: "sms.undelivered" },
  EXPIRED: { status: "expired", webhook: "sms.undelivered" },
  REJECTED: { status: "rejected", webhook: "sms.undelivered" },
  DELETED: { status: "failed", webhook: "sms.failed" },
  // ACCEPTD / ENROUTE / UNKNOWN are in-flight states we already model as "sent".
};

/**
 * Applies one MTN delivery receipt. Unknown correlation ids and in-flight
 * statuses are ignored (`applied: false`), so the endpoint can always 200 —
 * carriers retry aggressively on anything else.
 */
export async function processMtnDeliveryReceipt(payload: unknown): Promise<{ applied: boolean }> {
  const parsed = mtnNotificationSchema.safeParse(payload);
  if (!parsed.success) return { applied: false };

  const mapped = MTN_STATUS_MAP[parsed.data.deliveryStatus.toUpperCase()];
  if (!mapped) return { applied: false };

  return applyDeliveryStatus(
    eq(sms.id, parsed.data.clientCorrelatorId),
    mapped,
    parsed.data as Record<string, unknown>,
    parsed.data.deliveryStatus,
  );
}

// ---------------------------------------------------------------------------
// Orange

/**
 * Orange delivery receipt (deliveryInfoNotification). `callbackData` is the
 * resource id Orange returned when we sent, stored as `providerMessageId`
 * (comma-joined when one message went to several recipients).
 */
const orangeNotificationSchema = z
  .object({
    deliveryInfoNotification: z
      .object({
        callbackData: z.string().min(1),
        deliveryInfo: z
          .object({
            address: z.string().optional(),
            deliveryStatus: z.string().min(1),
          })
          .loose(),
      })
      .loose(),
  })
  .loose();

/** OMA delivery states → our status. */
const ORANGE_STATUS_MAP: Record<string, MappedStatus> = {
  DELIVEREDTOTERMINAL: { status: "delivered", webhook: "sms.delivered" },
  DELIVERYIMPOSSIBLE: { status: "undelivered", webhook: "sms.undelivered" },
  // DeliveredToNetwork / MessageWaiting / DeliveryUncertain are in-flight or
  // unknown states; the row already reads "sent" and a final receipt follows.
};

/**
 * Applies one Orange delivery receipt. Same contract as the MTN variant:
 * anything unmatched or non-final is ignored so the endpoint can always 200.
 */
export async function processOrangeDeliveryReceipt(
  payload: unknown,
): Promise<{ applied: boolean }> {
  const parsed = orangeNotificationSchema.safeParse(payload);
  if (!parsed.success) return { applied: false };

  const { callbackData, deliveryInfo } = parsed.data.deliveryInfoNotification;
  const mapped = ORANGE_STATUS_MAP[deliveryInfo.deliveryStatus.toUpperCase()];
  if (!mapped) return { applied: false };

  // Ids are UUIDs, so a substring match cannot hit the wrong row; the LIKE
  // only exists for multi-recipient sends whose ids are comma-joined.
  const where = or(
    eq(sms.providerMessageId, callbackData),
    like(sms.providerMessageId, `%${callbackData}%`),
  );
  if (!where) return { applied: false };
  return applyDeliveryStatus(
    where,
    mapped,
    parsed.data as Record<string, unknown>,
    deliveryInfo.deliveryStatus,
  );
}

// ---------------------------------------------------------------------------
// AWS End User Messaging (routing key `aws_sns`)

/**
 * Event published by an End User Messaging configuration set to its SNS
 * topic, which the callback route unwraps before calling this.
 * `messageId` is what `SendTextMessage` returned, stored as
 * `providerMessageId` (comma-joined when one message went to several
 * recipients).
 */
const eumEventSchema = z
  .object({
    messageId: z.string().min(1),
    messageStatus: z.string().min(1),
    messageStatusDescription: z.string().optional(),
  })
  .loose();

/**
 * Legacy shape: the record SNS `Publish` wrote to CloudWatch Logs when
 * delivery status logging was on. Still accepted so receipts already in
 * flight, or a deployment that has not moved to a configuration set yet, keep
 * closing the loop.
 */
const snsLogRecordSchema = z
  .object({
    notification: z.object({ messageId: z.string().min(1) }).loose(),
    status: z.string().min(1),
    delivery: z
      .object({
        providerResponse: z.string().optional(),
        destination: z.string().optional(),
      })
      .loose()
      .optional(),
  })
  .loose();

/**
 * Terminal message states. In-flight ones (PENDING, QUEUED, SENT, SUCCESSFUL)
 * are deliberately absent: the row is already `sent`, and `applyDeliveryStatus`
 * only moves a status forward, so listing them would be a no-op that reads as
 * if it did something.
 */
const AWS_STATUS_MAP: Record<string, MappedStatus> = {
  // End User Messaging
  DELIVERED: { status: "delivered", webhook: "sms.delivered" },
  UNREACHABLE: { status: "undelivered", webhook: "sms.undelivered" },
  CARRIER_UNREACHABLE: { status: "undelivered", webhook: "sms.undelivered" },
  UNKNOWN: { status: "undelivered", webhook: "sms.undelivered" },
  TTL_EXPIRED: { status: "expired", webhook: "sms.undelivered" },
  BLOCKED: { status: "rejected", webhook: "sms.undelivered" },
  CARRIER_BLOCKED: { status: "rejected", webhook: "sms.undelivered" },
  SPAM: { status: "rejected", webhook: "sms.undelivered" },
  INVALID: { status: "rejected", webhook: "sms.undelivered" },
  INVALID_MESSAGE: { status: "rejected", webhook: "sms.undelivered" },
  // Legacy CloudWatch record
  SUCCESS: { status: "delivered", webhook: "sms.delivered" },
  FAILURE: { status: "undelivered", webhook: "sms.undelivered" },
};

/**
 * Applies one AWS delivery event, in either the End User Messaging or the
 * legacy CloudWatch shape. Same contract as the carrier variants: unmatched
 * ids and non-terminal statuses are ignored so the endpoint can always 200.
 */
export async function processSnsDeliveryReceipt(payload: unknown): Promise<{ applied: boolean }> {
  const event = eumEventSchema.safeParse(payload);
  const legacy = event.success ? null : snsLogRecordSchema.safeParse(payload);

  let messageId: string;
  let status: string;
  let detail: string | undefined;
  if (event.success) {
    messageId = event.data.messageId;
    status = event.data.messageStatus;
    detail = event.data.messageStatusDescription;
  } else if (legacy?.success) {
    messageId = legacy.data.notification.messageId;
    status = legacy.data.status;
    detail = legacy.data.delivery?.providerResponse;
  } else {
    return { applied: false };
  }

  const mapped = AWS_STATUS_MAP[status.toUpperCase()];
  if (!mapped) return { applied: false };

  // Ids are UUIDs, so a substring match cannot hit the wrong row; the LIKE
  // only exists for multi-recipient sends whose ids are comma-joined.
  const where = or(eq(sms.providerMessageId, messageId), like(sms.providerMessageId, `%${messageId}%`));
  if (!where) return { applied: false };

  return applyDeliveryStatus(
    where,
    mapped,
    payload as Record<string, unknown>,
    detail ? `${status}: ${detail}` : status,
  );
}
