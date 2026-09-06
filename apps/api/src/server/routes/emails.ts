import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import {
  EMAIL_STATUSES,
  domain,
  email,
  emailAttachment,
  emailBatch,
  emailEvent,
} from "@retransmit/db/schema/email";
import type { EmailHeaders, EmailTag } from "@retransmit/db/schema/email";
import { extractEmailAddress, extractEmailDomain } from "@retransmit/email/address";
import {
  ATTACHMENTS_MAX,
  ATTACHMENTS_TOTAL_MAX_BYTES,
  AttachmentError,
  attachmentDownloadUrl,
  formatBytes,
  storeAttachments,
} from "@retransmit/email/attachments";
import { enqueueEmailSend, enqueueEmailSendBatch } from "@retransmit/queue";
import { and, asc, count, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import z from "zod";

import { apiKeyAuth } from "../auth";
import type { ApiKeyEnv } from "../auth";
import { readIdempotencyKey, runIdempotent, sendIdempotent } from "../idempotency";

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

/** Base64 of ATTACHMENTS_TOTAL_MAX_BYTES, with some slack for line breaks. */
const ATTACHMENT_CONTENT_MAX = Math.ceil((ATTACHMENTS_TOTAL_MAX_BYTES * 4) / 3) + 4096;
/**
 * Request body ceiling for single sends: the attachment budget once base64
 * encoded, plus bodies and headers. Enforced before parsing so an oversized
 * upload is refused instead of buffered.
 */
const SEND_BODY_MAX_BYTES = ATTACHMENT_CONTENT_MAX + 3 * 1024 * 1024;

const attachmentSchema = z
  .object({
    filename: z
      .string()
      .min(1)
      .max(255)
      .refine((value) => !/[\\/\u0000-\u001f]/.test(value) && value.trim() === value, {
        message: "Filename may not contain path separators or control characters",
      }),
    content: z.string().min(1).max(ATTACHMENT_CONTENT_MAX).optional(),
    path: z.url({ protocol: /^https?$/ }).max(2048).optional(),
    content_type: z
      .string()
      .max(255)
      .regex(/^[\w.+-]+\/[\w.+-]+$/, { message: "Must be a MIME type such as application/pdf" })
      .optional(),
    content_id: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9._@-]+$/, {
        message: "Content ids may only contain letters, digits, `.`, `_`, `@` and `-`",
      })
      .optional(),
  })
  .refine((value) => (value.content === undefined) !== (value.path === undefined), {
    message: "Provide either `content` (base64) or `path` (URL), not both",
  });

const emailFields = z.object({
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
});

const hasBody = { message: "Provide `html`, `text`, or both" };

const sendEmailSchema = emailFields
  .extend({
    attachments: z
      .array(attachmentSchema)
      .max(ATTACHMENTS_MAX)
      .refine(
        (attachments) => {
          const ids = attachments.map((a) => a.content_id).filter((id) => id !== undefined);
          return new Set(ids).size === ids.length;
        },
        { message: "Content ids must be unique" },
      )
      .optional(),
  })
  .refine((value) => value.html || value.text, hasBody);

const BATCH_MAX = 10_000;

/** Batch emails take the same fields minus attachments (as on Resend). */
const batchEmailSchema = emailFields
  .extend({
    attachments: z.custom<undefined>((value) => value === undefined, {
      message: "Attachments are not supported on the batch endpoint. Use POST /v1/emails.",
    }),
  })
  .refine((value) => value.html || value.text, hasBody);

const batchSchema = z.object({
  emails: z.array(batchEmailSchema).min(1).max(BATCH_MAX),
});

type SendEmailInput = z.infer<typeof sendEmailSchema>;
type EmailFieldsInput = z.infer<typeof emailFields>;

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
  input: EmailFieldsInput,
  ctx: {
    id?: string;
    userId: string;
    organizationId: string;
    apiKeyId: string;
    domainId: string;
    batchId?: string;
  },
) {
  return {
    id: ctx.id ?? createId("em"),
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
 * An `Idempotency-Key` header makes retries of the same request safe.
 */
emailRoutes.post("/batch", async (c) => {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    return c.json({ error: { code: "invalid_json", message: "Body must be valid JSON" } }, 400);
  }

  const idempotency = readIdempotencyKey(c);
  if (idempotency.error) return c.json(idempotency.error, 400);

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

  const result = await runIdempotent(
    { organizationId, key: idempotency.key, endpoint: "POST /v1/emails/batch", body: parsed.data },
    async () => {
      const batchId = createId("bt");
      const [batch] = await db
        .insert(emailBatch)
        .values({ id: batchId, userId, apiKeyId, total: inputs.length })
        .returning();
      if (!batch) {
        return {
          status: 500,
          body: { error: { code: "internal_error", message: "Could not create batch" } },
        };
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

      return {
        status: 202,
        body: {
          id: batchId,
          total: rows.length,
          status: "queued",
          created_at: batch.createdAt.toISOString(),
        },
      };
    },
  );
  return sendIdempotent(c, result);
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
 * An `Idempotency-Key` header makes retries of the same request safe.
 */
emailRoutes.post(
  "/",
  bodyLimit({
    maxSize: SEND_BODY_MAX_BYTES,
    onError: (c) =>
      c.json(
        {
          error: {
            code: "payload_too_large",
            message: `Request body exceeds ${formatBytes(SEND_BODY_MAX_BYTES)}. Attachments may total ${formatBytes(ATTACHMENTS_TOTAL_MAX_BYTES)} before base64 encoding.`,
          },
        },
        413,
      ),
  }),
  async (c) => {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    return c.json({ error: { code: "invalid_json", message: "Body must be valid JSON" } }, 400);
  }

  const idempotency = readIdempotencyKey(c);
  if (idempotency.error) return c.json(idempotency.error, 400);

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
  const sender = resolved.byName.get(name)!;

  const result = await runIdempotent(
    { organizationId, key: idempotency.key, endpoint: "POST /v1/emails", body: input },
    async () => {
      const emailId = createId("em");

      // Attachment bytes go to the bucket of the sending domain's region now,
      // so a bad file or unreachable URL is a 422 here rather than a failed
      // send later. The worker reads them back when it sends.
      let attachments;
      try {
        attachments = await storeAttachments(
          (input.attachments ?? []).map((attachment) => ({
            filename: attachment.filename,
            content: attachment.content,
            path: attachment.path,
            contentType: attachment.content_type,
            contentId: attachment.content_id,
          })),
          { organizationId, emailId, region: sender.region, createId: () => createId("att") },
        );
      } catch (error) {
        if (error instanceof AttachmentError) {
          return { status: 422, body: { error: { code: error.code, message: error.message } } };
        }
        throw error;
      }

      const row = toEmailRow(input, {
        id: emailId,
        userId,
        organizationId,
        apiKeyId: c.get("apiKeyId"),
        domainId: sender.id,
      });
      const created = await db.transaction(async (tx) => {
        const [inserted] = await tx.insert(email).values(row).returning();
        if (inserted && attachments.length > 0) {
          await tx
            .insert(emailAttachment)
            .values(attachments.map((attachment) => ({ ...attachment, emailId })));
        }
        return inserted;
      });
      if (!created) {
        return {
          status: 500,
          body: { error: { code: "internal_error", message: "Could not create email" } },
        };
      }

      await enqueueEmailSend(row.id);

      return {
        status: 202,
        body: { id: row.id, status: "queued", created_at: created.createdAt.toISOString() },
      };
    },
  );
  return sendIdempotent(c, result);
  },
);

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
  const attachments = await db
    .select()
    .from(emailAttachment)
    .where(eq(emailAttachment.emailId, row.id))
    .orderBy(asc(emailAttachment.createdAt));

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
    attachments: attachments.map(attachmentSummary),
  });
});

type AttachmentRow = typeof emailAttachment.$inferSelect;

function attachmentSummary(row: AttachmentRow) {
  return {
    id: row.id,
    filename: row.filename,
    content_type: row.contentType,
    size: row.size,
    content_id: row.contentId,
    inline: row.inline,
  };
}

/** Summary plus a signed download link while the file is still stored. */
async function attachmentWithDownload(row: AttachmentRow) {
  const expired = row.expiresAt.getTime() <= Date.now();
  return {
    ...attachmentSummary(row),
    expires_at: row.expiresAt.toISOString(),
    download_url: expired
      ? null
      : await attachmentDownloadUrl(
          { region: row.storageRegion, key: row.storageKey },
          { filename: row.filename, contentType: row.contentType },
        ),
  };
}

async function ownedEmailId(c: { req: { param: (name: string) => string | undefined }; get: (key: "userId") => string }) {
  const [row] = await db
    .select({ id: email.id })
    .from(email)
    .where(and(eq(email.id, c.req.param("id") ?? ""), eq(email.userId, c.get("userId"))));
  return row?.id ?? null;
}

/**
 * Attachments of one email with signed download links. Files are kept for 30
 * days after the send; after that `download_url` is null and only the
 * metadata remains.
 */
emailRoutes.get("/:id/attachments", async (c) => {
  const emailId = await ownedEmailId(c);
  if (!emailId) {
    return c.json({ error: { code: "not_found", message: "Email not found" } }, 404);
  }
  const rows = await db
    .select()
    .from(emailAttachment)
    .where(eq(emailAttachment.emailId, emailId))
    .orderBy(asc(emailAttachment.createdAt));
  return c.json({ attachments: await Promise.all(rows.map(attachmentWithDownload)) });
});

emailRoutes.get("/:id/attachments/:attachmentId", async (c) => {
  const emailId = await ownedEmailId(c);
  if (!emailId) {
    return c.json({ error: { code: "not_found", message: "Email not found" } }, 404);
  }
  const [row] = await db
    .select()
    .from(emailAttachment)
    .where(
      and(
        eq(emailAttachment.emailId, emailId),
        eq(emailAttachment.id, c.req.param("attachmentId")),
      ),
    );
  if (!row) {
    return c.json({ error: { code: "not_found", message: "Attachment not found" } }, 404);
  }
  return c.json(await attachmentWithDownload(row));
});
