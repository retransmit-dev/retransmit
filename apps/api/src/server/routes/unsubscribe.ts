import { ensureOrganizationForUser } from "@retransmit/auth/organization";
import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { email, emailEvent, suppression } from "@retransmit/db/schema/email";
import { extractEmailAddress } from "@retransmit/email/address";
import { legacyEmailIdForToken, verifyUnsubscribeToken } from "@retransmit/email/unsubscribe";
import { dispatchEmailEvent } from "@retransmit/email/webhooks";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

export const unsubscribeRoutes = new Hono();

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; font: 16px/1.6 system-ui, sans-serif; background: #0f1115; color: #e8eaed;
         display: grid; place-items: center; min-height: 100vh; padding: 24px; box-sizing: border-box; }
  main { max-width: 420px; text-align: center; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  p { margin: 0 0 20px; color: #a8adb5; overflow-wrap: anywhere; }
  button { font: inherit; padding: 10px 24px; border: 0; border-radius: 8px; cursor: pointer;
           background: #e8eaed; color: #0f1115; }
</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

function notFoundPage(): string {
  return page(
    "Link not found",
    "<h1>This link is not valid</h1><p>The unsubscribe link is broken or was tampered with. Copy the full link from the email and try again.</p>",
  );
}

async function loadEmailForToken(token: string) {
  // Legacy tokens come from bidpilot-era outreach links that app.captivaq.com
  // forwards here; they resolve to emails created by the one-time import.
  const emailId = verifyUnsubscribeToken(token) ?? legacyEmailIdForToken(token);
  if (!emailId) return null;
  const [row] = await db.select().from(email).where(eq(email.id, emailId));
  return row ?? null;
}

function recipientAddresses(row: typeof email.$inferSelect): string[] {
  return [
    ...new Set(
      row.to
        .map((value) => extractEmailAddress(value)?.toLowerCase())
        .filter((address): address is string => Boolean(address)),
    ),
  ];
}

/**
 * Confirmation page for the link in the email body. Unsubscribing happens on
 * POST only, so link scanners and prefetchers following the GET never
 * unsubscribe anyone.
 */
unsubscribeRoutes.get("/:token", async (c) => {
  const row = await loadEmailForToken(c.req.param("token"));
  if (!row) return c.html(notFoundPage(), 404);

  const addresses = recipientAddresses(row);
  return c.html(
    page(
      "Unsubscribe",
      `<h1>Unsubscribe from these emails?</h1>
<p>${escapeHtml(addresses.join(", "))} will no longer receive marketing email from this sender.</p>
<form method="post"><button type="submit">Unsubscribe</button></form>`,
    ),
  );
});

/**
 * Performs the unsubscribe. Reached from the confirmation page's form and
 * from mailbox providers' one-click unsubscribe (RFC 8058), which POSTs here
 * directly via the List-Unsubscribe headers. Idempotent.
 */
unsubscribeRoutes.post("/:token", async (c) => {
  const row = await loadEmailForToken(c.req.param("token"));
  if (!row) return c.html(notFoundPage(), 404);

  const addresses = recipientAddresses(row);
  const done = page(
    "Unsubscribed",
    `<h1>You're unsubscribed</h1>
<p>${escapeHtml(addresses.join(", "))} will no longer receive marketing email from this sender.</p>`,
  );
  if (addresses.length === 0) return c.html(done);

  // Emails sent before organizations existed carry no organizationId.
  const organizationId = row.organizationId ?? (await ensureOrganizationForUser(row.userId)).id;

  const inserted = await db
    .insert(suppression)
    .values(
      addresses.map((address) => ({
        id: createId("sup"),
        organizationId,
        email: address,
        reason: "unsubscribe" as const,
        sourceEmailId: row.id,
      })),
    )
    .onConflictDoNothing({ target: [suppression.organizationId, suppression.email] })
    .returning({ email: suppression.email });

  // Only the first unsubscribe records an event; repeat clicks are no-ops.
  if (inserted.length > 0) {
    await db.insert(emailEvent).values({
      id: createId("evt"),
      emailId: row.id,
      type: "email.unsubscribed",
      data: { addresses: inserted.map((entry) => entry.email) },
    });
    await dispatchEmailEvent(row.userId, "email.unsubscribed", {
      emailId: row.id,
      from: row.from,
      to: row.to,
      subject: row.subject,
      createdAt: row.createdAt.toISOString(),
      data: { addresses: inserted.map((entry) => entry.email) },
    });
  }

  return c.html(done);
});
