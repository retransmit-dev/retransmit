import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { domain, email, emailEvent } from "@retransmit/db/schema/email";
import { extractEmailAddress, extractEmailDomain } from "@retransmit/email/address";
import { sendEmail } from "@retransmit/email/ses";
import { dispatchEmailEvent } from "@retransmit/email/webhooks";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import z from "zod";

import { apiKeyAuth } from "../auth";
import type { ApiKeyEnv } from "../auth";

const addressList = z
  .union([z.string(), z.array(z.string()).min(1).max(50)])
  .transform((value) => (Array.isArray(value) ? value : [value]))
  .refine((values) => values.every((value) => extractEmailAddress(value) !== null), {
    message: "Contains an invalid email address",
  });

const sendEmailSchema = z
  .object({
    from: z.string().refine((value) => extractEmailAddress(value) !== null, {
      message: "`from` must be an email address or `Name <address>`",
    }),
    to: addressList,
    cc: addressList.optional(),
    bcc: addressList.optional(),
    reply_to: addressList.optional(),
    subject: z.string().min(1).max(998),
    html: z.string().max(1_000_000).optional(),
    text: z.string().max(1_000_000).optional(),
  })
  .refine((value) => value.html || value.text, {
    message: "Provide `html`, `text`, or both",
  });

export const emailRoutes = new Hono<ApiKeyEnv>();

emailRoutes.use("*", apiKeyAuth);

emailRoutes.post("/", async (c) => {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    return c.json({ error: { code: "invalid_json", message: "Body must be valid JSON" } }, 400);
  }

  const parsed = sendEmailSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return c.json(
      {
        error: {
          code: "validation_error",
          message: issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "Invalid body",
        },
      },
      422,
    );
  }
  const input = parsed.data;
  const userId = c.get("userId");

  const fromDomain = extractEmailDomain(input.from);
  const [senderDomain] = await db
    .select()
    .from(domain)
    .where(and(eq(domain.name, fromDomain ?? ""), eq(domain.userId, userId)));
  if (!senderDomain) {
    return c.json(
      {
        error: {
          code: "domain_not_found",
          message: `The domain \`${fromDomain}\` is not registered on your account. Add and verify it first.`,
        },
      },
      403,
    );
  }
  if (senderDomain.status !== "verified") {
    return c.json(
      {
        error: {
          code: "domain_not_verified",
          message: `The domain \`${fromDomain}\` is not verified yet (status: ${senderDomain.status}).`,
        },
      },
      403,
    );
  }

  const id = createId("em");
  const [created] = await db
    .insert(email)
    .values({
      id,
      userId,
      apiKeyId: c.get("apiKeyId"),
      domainId: senderDomain.id,
      from: input.from,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      replyTo: input.reply_to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    })
    .returning();
  if (!created) {
    return c.json({ error: { code: "internal_error", message: "Could not create email" } }, 500);
  }

  try {
    const { messageId } = await sendEmail({
      from: input.from,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      replyTo: input.reply_to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    await db
      .update(email)
      .set({ providerMessageId: messageId, status: "sent", lastEventAt: new Date() })
      .where(eq(email.id, id));
    await db.insert(emailEvent).values({ id: createId("evt"), emailId: id, type: "email.sent" });
    await dispatchEmailEvent(userId, "email.sent", {
      emailId: id,
      from: input.from,
      to: input.to,
      subject: input.subject,
      createdAt: created.createdAt.toISOString(),
    });

    return c.json({ id, status: "sent", created_at: created.createdAt.toISOString() });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Upstream provider error";
    await db
      .update(email)
      .set({ status: "failed", error: message, lastEventAt: new Date() })
      .where(eq(email.id, id));
    await db.insert(emailEvent).values({
      id: createId("evt"),
      emailId: id,
      type: "email.failed",
      data: { message },
    });
    await dispatchEmailEvent(userId, "email.failed", {
      emailId: id,
      from: input.from,
      to: input.to,
      subject: input.subject,
      createdAt: created.createdAt.toISOString(),
      data: { message },
    });

    return c.json({ error: { code: "send_failed", message } }, 502);
  }
});

emailRoutes.get("/:id", async (c) => {
  const [row] = await db
    .select()
    .from(email)
    .where(and(eq(email.id, c.req.param("id")), eq(email.userId, c.get("userId"))));
  if (!row) {
    return c.json({ error: { code: "not_found", message: "Email not found" } }, 404);
  }

  const events = await db
    .select({ type: emailEvent.type, createdAt: emailEvent.createdAt })
    .from(emailEvent)
    .where(eq(emailEvent.emailId, row.id))
    .orderBy(asc(emailEvent.createdAt));

  return c.json({
    id: row.id,
    from: row.from,
    to: row.to,
    cc: row.cc,
    bcc: row.bcc,
    reply_to: row.replyTo,
    subject: row.subject,
    status: row.status,
    error: row.error,
    created_at: row.createdAt.toISOString(),
    last_event_at: row.lastEventAt?.toISOString() ?? null,
    events: events.map((event) => ({
      type: event.type,
      created_at: event.createdAt.toISOString(),
    })),
  });
});
