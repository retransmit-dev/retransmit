import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { sms, smsEvent } from "@retransmit/db/schema/sms";
import { dispatchWebhookEvent } from "@retransmit/email/webhooks";
import { eq } from "drizzle-orm";

import { selectProvider } from "./provider";

function webhookPayload(row: typeof sms.$inferSelect) {
  return {
    smsId: row.id,
    from: row.from,
    to: row.to,
    country: row.country,
    provider: row.provider,
    segments: row.segments,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Processes one `sms-send` job: routes the message to a provider and records
 * the outcome. Idempotent — a row that is no longer `queued` is skipped, so a
 * retry after a partial failure never double-sends.
 *
 * Routing happens here (not at enqueue time) so a message queued while a
 * provider was down can still go out through whichever provider is best when
 * the job actually runs. Throws on provider failure so pg-boss retries with
 * backoff; an unroutable destination fails permanently right away.
 */
export async function processSmsSend(smsId: string): Promise<void> {
  const [row] = await db.select().from(sms).where(eq(sms.id, smsId));
  if (!row || row.status !== "queued") return;

  const provider = selectProvider(row.country);
  if (!provider) {
    const message = `No configured SMS provider can deliver to ${row.country ?? "this destination"}`;
    await db
      .update(sms)
      .set({ status: "failed", error: message, lastEventAt: new Date() })
      .where(eq(sms.id, smsId));
    await db.insert(smsEvent).values({
      id: createId("sev"),
      smsId,
      type: "sms.failed",
      data: { message },
    });
    await dispatchWebhookEvent(row.userId, "sms.failed", {
      ...webhookPayload(row),
      data: { message },
    });
    return;
  }

  try {
    const { providerMessageId } = await provider.send({
      id: row.id,
      from: row.from,
      to: row.to,
      text: row.text,
      country: row.country,
    });

    await db
      .update(sms)
      .set({
        provider: provider.key,
        providerMessageId,
        status: "sent",
        error: null,
        lastEventAt: new Date(),
      })
      .where(eq(sms.id, smsId));
    await db.insert(smsEvent).values({ id: createId("sev"), smsId, type: "sms.sent" });
    await dispatchWebhookEvent(row.userId, "sms.sent", {
      ...webhookPayload(row),
      provider: provider.key,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Upstream provider error";
    await db.update(sms).set({ error: message, lastEventAt: new Date() }).where(eq(sms.id, smsId));
    throw cause;
  }
}

/**
 * Called when a send job lands on the dead-letter queue: all retries are
 * exhausted, so the message is marked failed for good and an `sms.failed`
 * event/webhook goes out.
 */
export async function markSmsPermanentlyFailed(smsId: string): Promise<void> {
  const [row] = await db.select().from(sms).where(eq(sms.id, smsId));
  if (!row || row.status !== "queued") return;

  const message = row.error ?? "Send failed after all retries";
  await db
    .update(sms)
    .set({ status: "failed", error: message, lastEventAt: new Date() })
    .where(eq(sms.id, smsId));
  await db.insert(smsEvent).values({
    id: createId("sev"),
    smsId,
    type: "sms.failed",
    data: { message },
  });
  await dispatchWebhookEvent(row.userId, "sms.failed", {
    ...webhookPayload(row),
    data: { message },
  });
}
