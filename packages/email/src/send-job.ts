import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { email, emailEvent } from "@retransmit/db/schema/email";
import { eq } from "drizzle-orm";

import { sendEmail } from "./ses";
import { dispatchEmailEvent } from "./webhooks";

/**
 * Processes one `email-send` job: hands the email to SES and records the
 * outcome. Idempotent — a row that is no longer `queued` is skipped, so a
 * retry after a partial failure never double-sends (unless the crash landed
 * exactly between the SES call and the status update, which we accept).
 *
 * Throws on provider failure so pg-boss retries with backoff; the row keeps
 * status `queued` (with the last error recorded) until it either sends or the
 * job dead-letters.
 */
export async function processEmailSend(emailId: string): Promise<void> {
  const [row] = await db.select().from(email).where(eq(email.id, emailId));
  if (!row || row.status !== "queued") return;

  try {
    const { messageId } = await sendEmail({
      from: row.from,
      to: row.to,
      cc: row.cc ?? undefined,
      bcc: row.bcc ?? undefined,
      replyTo: row.replyTo ?? undefined,
      subject: row.subject,
      html: row.html ?? undefined,
      text: row.text ?? undefined,
    });

    await db
      .update(email)
      .set({ providerMessageId: messageId, status: "sent", error: null, lastEventAt: new Date() })
      .where(eq(email.id, emailId));
    await db.insert(emailEvent).values({ id: createId("evt"), emailId, type: "email.sent" });
    await dispatchEmailEvent(row.userId, "email.sent", {
      emailId,
      from: row.from,
      to: row.to,
      subject: row.subject,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Upstream provider error";
    await db
      .update(email)
      .set({ error: message, lastEventAt: new Date() })
      .where(eq(email.id, emailId));
    throw cause;
  }
}

/**
 * Called when a send job lands on the dead-letter queue: all retries are
 * exhausted, so the email is marked failed for good and an `email.failed`
 * event/webhook goes out.
 */
export async function markEmailPermanentlyFailed(emailId: string): Promise<void> {
  const [row] = await db.select().from(email).where(eq(email.id, emailId));
  if (!row || row.status !== "queued") return;

  const message = row.error ?? "Send failed after all retries";
  await db
    .update(email)
    .set({ status: "failed", error: message, lastEventAt: new Date() })
    .where(eq(email.id, emailId));
  await db.insert(emailEvent).values({
    id: createId("evt"),
    emailId,
    type: "email.failed",
    data: { message },
  });
  await dispatchEmailEvent(row.userId, "email.failed", {
    emailId,
    from: row.from,
    to: row.to,
    subject: row.subject,
    createdAt: row.createdAt.toISOString(),
    data: { message },
  });
}
