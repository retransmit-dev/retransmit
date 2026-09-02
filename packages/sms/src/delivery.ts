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
