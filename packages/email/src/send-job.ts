import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import {
  domain,
  email,
  emailAttachment,
  emailEvent,
  suppression,
} from "@retransmit/db/schema/email";
import { and, eq, inArray, ne } from "drizzle-orm";

import { extractEmailAddress } from "./address";
import { AttachmentMissingError, getAttachment } from "./attachments";
import { mailboxProviderFor } from "./mailbox-provider";
import { sendEmail } from "./ses";
import { UNSUBSCRIBE_URL_PLACEHOLDER, unsubscribeUrl } from "./unsubscribe";
import { dispatchEmailEvent } from "./webhooks";

function bareAddress(value: string): string {
  return extractEmailAddress(value)?.toLowerCase() ?? "";
}

/** `user@example.com` -> `@example.com`. */
function domainEntry(address: string): string {
  return address.slice(address.lastIndexOf("@"));
}

/**
 * Drops recipients that are on the organization's suppression list. Returns
 * null when every `to` recipient is suppressed, meaning nothing should be
 * sent at all. Unsubscribes only block marketing sends; bounces, complaints
 * and manual entries block everything. A suppression entry of the bare form
 * `@example.com` suppresses every address at that domain.
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

  const domains = [...new Set(addresses.map(domainEntry))];
  const rows = await db
    .select({ email: suppression.email })
    .from(suppression)
    .where(
      and(
        eq(suppression.organizationId, row.organizationId),
        inArray(suppression.email, [...addresses, ...domains]),
        row.marketing ? undefined : ne(suppression.reason, "unsubscribe"),
      ),
    );
  if (rows.length === 0) return asIs;

  const suppressed = new Set(rows.map((entry) => entry.email));
  const keep = (value: string) => {
    const address = bareAddress(value);
    return !suppressed.has(address) && !suppressed.has(domainEntry(address));
  };
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

/** Replaces the header with this name (case-insensitively), or appends it. */
function setHeader(headers: { name: string; value: string }[], name: string, value: string) {
  const index = headers.findIndex((header) => header.name.toLowerCase() === name.toLowerCase());
  if (index === -1) headers.push({ name, value });
  else headers[index] = { name, value };
}

/**
 * Records who runs the recipient's mailbox, so deliverability can be read per
 * provider rather than as one average. A custom domain tells you nothing on
 * its own: the same small business could be on Microsoft 365, Google
 * Workspace or their web host, and the three filter very differently.
 *
 * Runs after the send and never fails it. The lookup is cached per domain, so
 * this is one DNS query per new domain rather than one per email.
 */
async function recordRecipientProvider(emailId: string, recipient: string | undefined) {
  if (!recipient) return;
  try {
    const provider = await mailboxProviderFor(recipient);
    if (!provider) return;
    await db.update(email).set({ recipientProvider: provider }).where(eq(email.id, emailId));
  } catch {
    // Diagnostics only. A resolver or database hiccup here must not turn a
    // delivered email into a retried job.
  }
}

/**
 * Processes one `email-send` job: hands the email to SES and records the
 * outcome. Idempotent — a row that is no longer `queued` or `scheduled` is
 * skipped, so a retry after a partial failure never double-sends (unless the
 * crash landed exactly between the SES call and the status update, which we
 * accept). Cancelling a scheduled email works the same way: the status moves
 * to `canceled` and the job that fires later finds nothing to do.
 *
 * Throws on provider failure so pg-boss retries with backoff; the row keeps
 * status `queued` (with the last error recorded) until it either sends or the
 * job dead-letters.
 */
export async function processEmailSend(emailId: string): Promise<void> {
  const [row] = await db.select().from(email).where(eq(email.id, emailId));
  if (!row || (row.status !== "queued" && row.status !== "scheduled")) return;

  // A rescheduled email has a second job waiting at its new time, so the job
  // that fires at the old, earlier time must not send. Cancelling it in
  // pg-boss would need us to track job ids; letting an early job find the row
  // not yet due keeps the scheduled time in one place, the row itself.
  if (row.scheduledAt && row.scheduledAt.getTime() > Date.now()) return;

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

  // Caller-supplied headers (X-Entity-Ref-ID and the like) go first. Marketing
  // sends then carry an unsubscribe link: the `{{{unsubscribe_url}}}`
  // placeholder in the body plus RFC 8058 one-click headers, which providers
  // like Gmail surface as an "Unsubscribe" action at the top of the message.
  // Those override a caller's List-Unsubscribe so the hosted flow always works.
  let html = row.html ?? undefined;
  let text = row.text ?? undefined;
  const headers = Object.entries(row.headers ?? {}).map(([name, value]) => ({ name, value }));
  if (row.marketing) {
    const url = unsubscribeUrl(row.id);
    html = html?.replaceAll(UNSUBSCRIBE_URL_PLACEHOLDER, url);
    text = text?.replaceAll(UNSUBSCRIBE_URL_PLACEHOLDER, url);
    setHeader(headers, "List-Unsubscribe", `<${url}>`);
    setHeader(headers, "List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
  }

  // SES identities are regional: send out of the region the from-domain was
  // verified in. Rows without a domain (legacy) use the platform default.
  let region: string | undefined;
  if (row.domainId) {
    const [sender] = await db
      .select({ region: domain.region })
      .from(domain)
      .where(eq(domain.id, row.domainId));
    region = sender?.region;
  }

  // Attachment bytes were parked in S3 by the API. An object that is gone
  // (past the 30-day lifecycle) will not come back, so that is a permanent
  // failure rather than something to retry.
  const attachmentRows = await db
    .select()
    .from(emailAttachment)
    .where(eq(emailAttachment.emailId, emailId));
  let attachments;
  try {
    attachments = await Promise.all(
      attachmentRows.map(async (attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        contentId: attachment.contentId ?? undefined,
        inline: attachment.inline,
        content: await getAttachment({
          region: attachment.storageRegion,
          key: attachment.storageKey,
        }),
      })),
    );
  } catch (cause) {
    if (!(cause instanceof AttachmentMissingError)) throw cause;
    await db
      .update(email)
      .set({ error: `An attachment is no longer available: ${cause.message}` })
      .where(eq(email.id, emailId));
    await markEmailPermanentlyFailed(emailId);
    return;
  }

  try {
    const { messageId } = await sendEmail({
      region,
      from: row.from,
      to: recipients.to,
      cc: recipients.cc,
      bcc: recipients.bcc,
      replyTo: row.replyTo ?? undefined,
      subject: row.subject,
      html,
      text,
      headers: headers.length > 0 ? headers : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
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

  // Trailing work: outside the try so a slow resolver cannot delay the
  // `email.sent` webhook, and cannot be mistaken for a send failure.
  await recordRecipientProvider(emailId, recipients.to[0]);
}

/**
 * Called when a send job lands on the dead-letter queue: all retries are
 * exhausted, so the email is marked failed for good and an `email.failed`
 * event/webhook goes out.
 */
export async function markEmailPermanentlyFailed(emailId: string): Promise<void> {
  const [row] = await db.select().from(email).where(eq(email.id, emailId));
  // A scheduled email keeps that status right up to the send, so it has to be
  // failable too; otherwise an exhausted scheduled job would sit as
  // `scheduled` for ever with nothing left to run it.
  if (!row || (row.status !== "queued" && row.status !== "scheduled")) return;

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
