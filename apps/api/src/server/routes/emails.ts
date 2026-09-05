import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { EMAIL_STATUSES, domain, email, emailBatch, emailEvent } from "@retransmit/db/schema/email";
import type { EmailHeaders, EmailTag } from "@retransmit/db/schema/email";
import { extractEmailAddress, extractEmailDomain } from "@retransmit/email/address";
import { enqueueEmailSend, enqueueEmailSendBatch } from "@retransmit/queue";
import { and, asc, count, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
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

/** Letters, digits, underscore and dash, like Resend and Postmark tags. */
const TAG_PATTERN = /^[A-Za-z0-9_-]+$/;
const TAG_MAX = 10;

const tagSchema = z.object({
  name: z.string().min(1).max(256).regex(TAG_PATTERN, {
    message: "Tag names may only contain letters, digits, underscores and dashes",
  }),
  value: z.string().min(1).max(256).regex(TAG_PATTERN, {
    message: "Tag values may only contain letters, digits, underscores and dashes",
  }),
});

const tagList = z
  .array(tagSchema)
  .max(TAG_MAX)
  .refine((tags) => new Set(tags.map((tag) => tag.name)).size === tags.length, {
    message: "Tag names must be unique",
  });

/**
 * Headers Retransmit or SES set themselves. Letting callers override them
 * would break delivery, authentication or our own bookkeeping, so they are
 * rejected up front instead of silently overwritten.
 */
const RESERVED_HEADERS = new Set(
  [
    "From",
    "Sender",
    "To",
    "Cc",
    "Bcc",
    "Reply-To",
    "Subject",
    "Date",
    "Message-ID",
    "Return-Path",
    "MIME-Version",
    "Content-Type",
    "Content-Transfer-Encoding",
    "Content-Disposition",
    "DKIM-Signature",
    "Received",
    "Resent-From",
    "Resent-To",
    "Resent-Date",
    "X-SES-CONFIGURATION-SET",
  ].map((name) => name.toLowerCase()),
);

/** RFC 5322 field name: printable ASCII except colon and space. SES caps it at 126 bytes. */
const HEADER_NAME_PATTERN = /^[!-9;-~]{1,126}$/;
const HEADER_VALUE_MAX = 870;
const HEADERS_MAX = 20;

/**
 * Custom headers as a name → value object, like `{ "X-Entity-Ref-ID": "..." }`.
 * Names are kept as given; duplicates that differ only by case are rejected
 * because header names are case-insensitive on the wire.
 */
const headersSchema = z
  .record(
    z.string(),
    z
      .string()
      .min(1)
      .max(HEADER_VALUE_MAX)
      .refine((value) => !/[\r\n]/.test(value), {
        message: "Header values may not contain line breaks",
      }),
  )
  .superRefine((headers, ctx) => {
    const names = Object.keys(headers);
    if (names.length > HEADERS_MAX) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `At most ${HEADERS_MAX} headers` });
      return;
    }
    const seen = new Set<string>();
    for (const name of names) {
      const key = name.toLowerCase();
      if (!HEADER_NAME_PATTERN.test(name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [name],
          message: "Header names may only contain printable ASCII without `:` (up to 126 characters)",
        });
      }
      if (RESERVED_HEADERS.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [name],
          message: `\`${name}\` is set by Retransmit and cannot be overridden`,
        });
      }
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [name],
          message: `\`${name}\` is given more than once (header names are case-insensitive)`,
        });
      }
      seen.add(key);
    }
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
    marketing: z.boolean().optional(),
    tags: tagList.optional(),
    headers: headersSchema.optional(),
  })
  .refine((value) => value.html || value.text, {
    message: "Provide `html`, `text`, or both",
  });

const BATCH_MAX = 10_000;

const batchSchema = z.object({
  emails: z.array(sendEmailSchema).min(1).max(BATCH_MAX),
});

type SendEmailInput = z.infer<typeof sendEmailSchema>;

const LIST_MAX = 100;
const LIST_DEFAULT = 50;

/**
 * Query string for GET /. Tags arrive as repeatable `tag=name:value` params;
 * the tag character set excludes `:` so the split is unambiguous.
 */
const listEmailsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(LIST_MAX).default(LIST_DEFAULT),
  cursor: z
    .string()
    .datetime({ offset: true, message: "cursor must be the `next_cursor` from a previous page" })
    .optional(),
  status: z.enum(EMAIL_STATUSES).optional(),
  batch_id: z.string().min(1).optional(),
  tag: z
    .array(
      z.string().transform((raw, ctx) => {
        const index = raw.indexOf(":");
        const candidate = { name: raw.slice(0, index), value: raw.slice(index + 1) };
        const parsed = tagSchema.safeParse(candidate);
        if (index === -1 || !parsed.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "tag must be `name:value` using letters, digits, underscores and dashes",
          });
          return z.NEVER;
        }
        return parsed.data;
      }),
    )
    .max(TAG_MAX)
    .default([]),
});

/** Matches emails carrying every one of these name/value pairs (uses the GIN index). */
function tagsCondition(tags: EmailTag[]) {
  return sql`${email.tags} @> ${JSON.stringify(tags)}::jsonb`;
}

/**
 * Loads the organization's registered domains for the given `from` addresses
 * and returns a name → domain map, or an error response body if any domain
 * is missing or unverified.
 */
async function resolveSenderDomains(organizationId: string, froms: string[]) {
  const names = [...new Set(froms.map((from) => extractEmailDomain(from) ?? ""))];
  const rows = await db
    .select()
    .from(domain)
    .where(and(inArray(domain.name, names), eq(domain.organizationId, organizationId)));
  const byName = new Map(rows.map((row) => [row.name, row]));

  for (const name of names) {
    const row = byName.get(name);
    if (!row) {
      return {
        error: {
          status: 403 as const,
          body: {
            error: {
              code: "domain_not_found",
              message: `The domain \`${name}\` is not registered on your organization. Add and verify it first.`,
            },
          },
        },
      };
    }
    if (row.status !== "verified") {
      return {
        error: {
          status: 403 as const,
          body: {
            error: {
              code: "domain_not_verified",
              message: `The domain \`${name}\` is not verified yet (status: ${row.status}).`,
            },
          },
        },
      };
    }
  }
  return { byName };
}

function toEmailRow(
  input: SendEmailInput,
  ctx: {
    userId: string;
    organizationId: string;
    apiKeyId: string;
    domainId: string;
    batchId?: string;
  },
) {
  return {
    id: createId("em"),
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    apiKeyId: ctx.apiKeyId,
    domainId: ctx.domainId,
    batchId: ctx.batchId,
    from: input.from,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    replyTo: input.reply_to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    marketing: input.marketing ?? false,
    tags: input.tags && input.tags.length > 0 ? input.tags : null,
    headers: toStoredHeaders(input.headers),
  };
}

function toStoredHeaders(headers: EmailHeaders | undefined): EmailHeaders | null {
  return headers && Object.keys(headers).length > 0 ? headers : null;
}

export const emailRoutes = new Hono<ApiKeyEnv>();

emailRoutes.use("*", apiKeyAuth);

/**
 * Submits up to 10,000 emails in one request. Rows are stored as `queued`
 * and handed to the worker, which sends them at the account's SES rate with
 * retries and a dead-letter queue. Track progress with GET /batch/:id.
 */
emailRoutes.post("/batch", async (c) => {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    return c.json({ error: { code: "invalid_json", message: "Body must be valid JSON" } }, 400);
  }

  const parsed = batchSchema.safeParse(json);
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
  const inputs = parsed.data.emails;
  const userId = c.get("userId");
  const organizationId = c.get("organizationId");
  const apiKeyId = c.get("apiKeyId");

  const resolved = await resolveSenderDomains(organizationId, inputs.map((input) => input.from));
  if (resolved.error) return c.json(resolved.error.body, resolved.error.status);

  const batchId = createId("bt");
  const [batch] = await db
    .insert(emailBatch)
    .values({ id: batchId, userId, apiKeyId, total: inputs.length })
    .returning();
  if (!batch) {
    return c.json({ error: { code: "internal_error", message: "Could not create batch" } }, 500);
  }

  const rows = inputs.map((input) => {
    const name = extractEmailDomain(input.from) ?? "";
    return toEmailRow(input, {
      userId,
      organizationId,
      apiKeyId,
      domainId: resolved.byName.get(name)!.id,
      batchId,
    });
  });

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(email).values(rows.slice(i, i + CHUNK));
  }
  await enqueueEmailSendBatch(rows.map((row) => row.id));

  return c.json(
    { id: batchId, total: rows.length, status: "queued", created_at: batch.createdAt.toISOString() },
    202,
  );
});

/** Batch progress: how many emails are in each status so far. */
emailRoutes.get("/batch/:id", async (c) => {
  const [batch] = await db
    .select()
    .from(emailBatch)
    .where(and(eq(emailBatch.id, c.req.param("id")), eq(emailBatch.userId, c.get("userId"))));
  if (!batch) {
    return c.json({ error: { code: "not_found", message: "Batch not found" } }, 404);
  }

  const grouped = await db
    .select({ status: email.status, count: count() })
    .from(email)
    .where(eq(email.batchId, batch.id))
    .groupBy(email.status);

  const counts: Record<string, number> = {};
  let done = 0;
  for (const row of grouped) {
    counts[row.status] = row.count;
    if (row.status !== "queued" && row.status !== "scheduled") done += row.count;
  }

  return c.json({
    id: batch.id,
    total: batch.total,
    processed: done,
    counts,
    created_at: batch.createdAt.toISOString(),
  });
});

/**
 * Queues a single email. Returns 202 immediately; the worker sends it at the
 * account's SES rate. Poll GET /:id or subscribe to webhooks for the outcome.
 */
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
  const organizationId = c.get("organizationId");

  const resolved = await resolveSenderDomains(organizationId, [input.from]);
  if (resolved.error) return c.json(resolved.error.body, resolved.error.status);
  const name = extractEmailDomain(input.from) ?? "";

  const row = toEmailRow(input, {
    userId,
    organizationId,
    apiKeyId: c.get("apiKeyId"),
    domainId: resolved.byName.get(name)!.id,
  });
  const [created] = await db.insert(email).values(row).returning();
  if (!created) {
    return c.json({ error: { code: "internal_error", message: "Could not create email" } }, 500);
  }

  await enqueueEmailSend(row.id);

  return c.json({ id: row.id, status: "queued", created_at: created.createdAt.toISOString() }, 202);
});

/**
 * Lists the account's emails, newest first, filtered by tag, status or batch.
 * Paginated with an opaque `cursor`; pass `next_cursor` back to get the next
 * page. Every `tag` filter must match for an email to be included.
 */
emailRoutes.get("/", async (c) => {
  const query = c.req.query();
  const parsed = listEmailsSchema.safeParse({ ...query, tag: c.req.queries("tag") ?? [] });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return c.json(
      {
        error: {
          code: "validation_error",
          message: issue ? `${issue.path.join(".") || "query"}: ${issue.message}` : "Invalid query",
        },
      },
      422,
    );
  }
  const input = parsed.data;

  const conditions: SQL[] = [eq(email.userId, c.get("userId"))];
  if (input.tag.length > 0) conditions.push(tagsCondition(input.tag));
  if (input.status) conditions.push(eq(email.status, input.status));
  if (input.batch_id) conditions.push(eq(email.batchId, input.batch_id));
  if (input.cursor) conditions.push(lt(email.createdAt, new Date(input.cursor)));

  const rows = await db
    .select({
      id: email.id,
      batchId: email.batchId,
      from: email.from,
      to: email.to,
      subject: email.subject,
      marketing: email.marketing,
      tags: email.tags,
      status: email.status,
      error: email.error,
      createdAt: email.createdAt,
      lastEventAt: email.lastEventAt,
    })
    .from(email)
    .where(and(...conditions))
    .orderBy(desc(email.createdAt))
    .limit(input.limit + 1);

  const hasMore = rows.length > input.limit;
  const page = hasMore ? rows.slice(0, input.limit) : rows;
  const last = page[page.length - 1];

  return c.json({
    emails: page.map((row) => ({
      id: row.id,
      batch_id: row.batchId,
      from: row.from,
      to: row.to,
      subject: row.subject,
      marketing: row.marketing,
      tags: row.tags ?? [],
      status: row.status,
      error: row.error,
      created_at: row.createdAt.toISOString(),
      last_event_at: row.lastEventAt?.toISOString() ?? null,
    })),
    has_more: hasMore,
    next_cursor: hasMore && last ? last.createdAt.toISOString() : null,
  });
});

/**
 * Distinct tag name/value pairs across the account's emails with how many
 * emails carry each. Same data the dashboard filter picker shows.
 */
emailRoutes.get("/tags", async (c) => {
  const result = await db.execute<{ name: string; value: string; count: number }>(sql`
    select tag->>'name' as name, tag->>'value' as value, count(*)::int as count
    from ${email}, jsonb_array_elements(${email.tags}) as tag
    where ${email.userId} = ${c.get("userId")} and ${email.tags} is not null
    group by 1, 2
    order by 1, 2
    limit 500
  `);
  return c.json({ tags: result.rows });
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
    batch_id: row.batchId,
    from: row.from,
    to: row.to,
    cc: row.cc,
    bcc: row.bcc,
    reply_to: row.replyTo,
    subject: row.subject,
    marketing: row.marketing,
    tags: row.tags ?? [],
    headers: row.headers,
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
