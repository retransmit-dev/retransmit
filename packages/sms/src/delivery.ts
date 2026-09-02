import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { sms, smsEvent } from "@retransmit/db/schema/sms";
import type { SmsStatus } from "@retransmit/db/schema/sms";
import type { WebhookEventType } from "@retransmit/db/schema/email";
import { dispatchWebhookEvent } from "@retransmit/email/webhooks";
import { eq } from "drizzle-orm";
import z from "zod";

/**
 * MTN delivery receipt (DeliveryNotificationRequest). `clientCorrelatorId`
 * echoes the id we sent, which is our row id.
 */
const deliveryNotificationSchema = z
  .object({
    clientCorrelatorId: z.string().min(1),
    deliveryStatus: z.string().min(1),
  })
  .loose();

/** SMPP-style delivery states → our status + webhook event. */
const DELIVERY_STATUS_MAP: Record<string, { status: SmsStatus; webhook: WebhookEventType }> = {
  DELIVERED: { status: "delivered", webhook: "sms.delivered" },
  UNDELIVERED: { status: "undelivered", webhook: "sms.undelivered" },
  EXPIRED: { status: "expired", webhook: "sms.undelivered" },
  REJECTED: { status: "rejected", webhook: "sms.undelivered" },
  DELETED: { status: "failed", webhook: "sms.failed" },
  // ACCEPTD / ENROUTE / UNKNOWN are in-flight states we already model as "sent".
};

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
 * Applies one MTN delivery receipt. Unknown correlation ids and in-flight
 * statuses are ignored (`applied: false`), so the endpoint can always 200 —
 * carriers retry aggressively on anything else.
 */
export async function processMtnDeliveryReceipt(payload: unknown): Promise<{ applied: boolean }> {
  const parsed = deliveryNotificationSchema.safeParse(payload);
  if (!parsed.success) return { applied: false };

  const mapped = DELIVERY_STATUS_MAP[parsed.data.deliveryStatus.toUpperCase()];
  if (!mapped) return { applied: false };

  const [row] = await db.select().from(sms).where(eq(sms.id, parsed.data.clientCorrelatorId));
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
    data: parsed.data as Record<string, unknown>,
  });
  await dispatchWebhookEvent(row.userId, mapped.webhook, {
    smsId: row.id,
    from: row.from,
    to: row.to,
    country: row.country,
    provider: row.provider,
    segments: row.segments,
    createdAt: row.createdAt.toISOString(),
    data: { deliveryStatus: parsed.data.deliveryStatus },
  });
  return { applied: true };
}
