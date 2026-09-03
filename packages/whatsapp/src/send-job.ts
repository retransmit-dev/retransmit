import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { whatsappEvent, whatsappMessage } from "@retransmit/db/schema/whatsapp";
import { dispatchWebhookEvent } from "@retransmit/email/webhooks";
import { eq } from "drizzle-orm";

import { webhookPayload } from "./delivery";
import { selectProvider } from "./provider";

/**
 * Processes one `whatsapp-send` job: routes the message to a provider and
 * records the outcome. Idempotent — a row that is no longer `queued` is
 * skipped, so a retry after a partial failure never double-sends.
 *
 * Routing happens here (not at enqueue time) so a message queued while a
 * provider was down can still go out through whichever provider is best when
 * the job actually runs. Throws on provider failure so pg-boss retries with
 * backoff; an unroutable destination fails permanently right away.
 */
export async function processWhatsappSend(messageId: string): Promise<void> {
  const [row] = await db.select().from(whatsappMessage).where(eq(whatsappMessage.id, messageId));
  if (!row || row.status !== "queued") return;

  const provider = selectProvider(row.country);
  if (!provider) {
    const message = `No configured WhatsApp provider can deliver to ${row.country ?? "this destination"}`;
    await db
      .update(whatsappMessage)
      .set({ status: "failed", error: message, lastEventAt: new Date() })
      .where(eq(whatsappMessage.id, messageId));
    await db.insert(whatsappEvent).values({
      id: createId("wae"),
      messageId,
      type: "whatsapp.failed",
      data: { message },
    });
    await dispatchWebhookEvent(row.userId, "whatsapp.failed", {
      ...webhookPayload(row),
      data: { message },
    });
    return;
  }

  try {
    const { providerMessageId } = await provider.send({
      id: row.id,
      to: row.to,
      country: row.country,
      type: row.type,
      text: row.text,
      previewUrl: row.previewUrl,
      template: row.template,
      media: row.media,
    });

    await db
      .update(whatsappMessage)
      .set({
        provider: provider.key,
        providerMessageId,
        status: "sent",
        error: null,
        lastEventAt: new Date(),
      })
      .where(eq(whatsappMessage.id, messageId));
    await db.insert(whatsappEvent).values({
      id: createId("wae"),
      messageId,
      type: "whatsapp.sent",
    });
    await dispatchWebhookEvent(row.userId, "whatsapp.sent", {
      ...webhookPayload(row),
      provider: provider.key,
      providerMessageId: providerMessageId ?? null,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Upstream provider error";
    await db
      .update(whatsappMessage)
      .set({ error: message, lastEventAt: new Date() })
      .where(eq(whatsappMessage.id, messageId));
    throw cause;
  }
}

/**
 * Called when a send job lands on the dead-letter queue: all retries are
 * exhausted, so the message is marked failed for good and a
 * `whatsapp.failed` event/webhook goes out.
 */
export async function markWhatsappPermanentlyFailed(messageId: string): Promise<void> {
  const [row] = await db.select().from(whatsappMessage).where(eq(whatsappMessage.id, messageId));
  if (!row || row.status !== "queued") return;

  const message = row.error ?? "Send failed after all retries";
  await db
    .update(whatsappMessage)
    .set({ status: "failed", error: message, lastEventAt: new Date() })
    .where(eq(whatsappMessage.id, messageId));
  await db.insert(whatsappEvent).values({
    id: createId("wae"),
    messageId,
    type: "whatsapp.failed",
    data: { message },
  });
  await dispatchWebhookEvent(row.userId, "whatsapp.failed", {
    ...webhookPayload(row),
    data: { message },
  });
}
