import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { email, emailEvent, suppression } from "@retransmit/db/schema/email";
import { and, eq, inArray, ne } from "drizzle-orm";

import { extractEmailAddress } from "./address";
import { sendEmail } from "./ses";
import { UNSUBSCRIBE_URL_PLACEHOLDER, unsubscribeUrl } from "./unsubscribe";
import { dispatchEmailEvent } from "./webhooks";

function bareAddress(value: string): string {
  return extractEmailAddress(value)?.toLowerCase() ?? "";
}

/**
 * Drops recipients that are on the organization's suppression list. Returns
 * null when every `to` recipient is suppressed, meaning nothing should be
 * sent at all. Unsubscribes only block marketing sends; bounces, complaints
 * and manual entries block everything.
 */
async function filterSuppressedRecipients(row: typeof email.$inferSelect): Promise<{
  to: string[];
  cc: string[] | undefined;
  bcc: string[] | undefined;
} | null> {
  const asIs = { to: row.to, cc: row.cc ?? undefined, bcc: row.bcc ?? undefined };
  if (!row.organizationId) return asIs;

  const addresses = [
    ...new Set(
      [...row.to, ...(row.cc ?? []), ...(row.bcc ?? [])].map(bareAddress).filter(Boolean),
    ),
  ];
  if (addresses.length === 0) return asIs;

  const rows = await db
    .select({ email: suppression.email })
    .from(suppression)
    .where(
      and(
        eq(suppression.organizationId, row.organizationId),
        inArray(suppression.email, addresses),
        row.marketing ? undefined : ne(suppression.reason, "unsubscribe"),
      ),
    );
  if (rows.length === 0) return asIs;

  const suppressed = new Set(rows.map((entry) => entry.email));
  const keep = (value: string) => !suppressed.has(bareAddress(value));
  const to = row.to.filter(keep);
  if (to.length === 0) return null;
  const cc = row.cc?.filter(keep);
  const bcc = row.bcc?.filter(keep);
  return {
    to,
    cc: cc && cc.length > 0 ? cc : undefined,
    bcc: bcc && bcc.length > 0 ? bcc : undefined,
  };
}

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

  const recipients = await filterSuppressedRecipients(row);
  if (recipients === null) {
    await db
      .update(email)
      .set({
        status: "suppressed",
        error: "All recipients are on the suppression list",
        lastEventAt: new Date(),
      })
      .where(eq(email.id, emailId));
    return;
  }

  // Marketing sends carry an unsubscribe link: the `{{{unsubscribe_url}}}`
  // placeholder in the body plus RFC 8058 one-click headers, which providers
  // like Gmail surface as an "Unsubscribe" action at the top of the message.
  let html = row.html ?? undefined;
  let text = row.text ?? undefined;
  let headers: { name: string; value: string }[] | undefined;
  if (row.marketing) {
    const url = unsubscribeUrl(row.id);
    html = html?.replaceAll(UNSUBSCRIBE_URL_PLACEHOLDER, url);
    text = text?.replaceAll(UNSUBSCRIBE_URL_PLACEHOLDER, url);
    headers = [
      { name: "List-Unsubscribe", value: `<${url}>` },
      { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" },
    ];
  }

  try {
    const { messageId } = await sendEmail({
      from: row.from,
      to: recipients.to,
      cc: recipients.cc,
      bcc: recipients.bcc,
      replyTo: row.replyTo ?? undefined,
      subject: row.subject,
      html,
      text,
      headers,
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
