import { db } from "@retransmit/db";
import { email, emailBatch, emailEvent } from "@retransmit/db/schema/email";
import { EMAIL_STATUSES } from "@retransmit/db/schema/email";
import type { EmailStatus, EmailTag } from "@retransmit/db/schema/email";
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, lte, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import z from "zod";

import { protectedProcedure, router } from "../index";

/** Case-insensitive match on recipient, sender or subject. */
function searchCondition(search: string) {
  const escaped = search.trim().toLowerCase().replace(/[%_\\]/g, "\\$&");
  const pattern = `%${escaped}%`;
  return or(
    ilike(email.subject, pattern),
    ilike(email.from, pattern),
    // `to` is a jsonb array of addresses; matching its text form covers every recipient.
    sql`${email.to}::text ilike ${pattern}`,
  );
}

/** Tag names and values allow letters, digits, underscore and dash. */
const tagInput = z.object({
  name: z.string().min(1).max(256),
  value: z.string().min(1).max(256),
});

/** Matches emails carrying exactly this name/value pair (uses the GIN index). */
function tagCondition(tag: EmailTag) {
  const needle: EmailTag[] = [{ name: tag.name, value: tag.value }];
  return sql`${email.tags} @> ${JSON.stringify(needle)}::jsonb`;
}

export const emailRouter = router({
  /** Live counts of the user's emails per status (drives the stats header). */
  stats: protectedProcedure.query(async ({ ctx }) => {
    const grouped = await db
      .select({ status: email.status, count: count() })
      .from(email)
      .where(eq(email.userId, ctx.session.user.id))
      .groupBy(email.status);

    const counts = Object.fromEntries(EMAIL_STATUSES.map((status) => [status, 0])) as Record<
      EmailStatus,
      number
    >;
    let total = 0;
    for (const row of grouped) {
      counts[row.status] = row.count;
      total += row.count;
    }
    return { counts, total };
  }),

  /** Recent batches with per-status progress. */
  batches: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }).default({ limit: 10 }))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(emailBatch)
        .where(eq(emailBatch.userId, ctx.session.user.id))
        .orderBy(desc(emailBatch.createdAt))
        .limit(input.limit);
      if (rows.length === 0) return [];

      const grouped = await db
        .select({ batchId: email.batchId, status: email.status, count: count() })
        .from(email)
        .where(
          inArray(
            email.batchId,
            rows.map((row) => row.id),
          ),
        )
        .groupBy(email.batchId, email.status);

      return rows.map((batch) => {
        const counts: Partial<Record<EmailStatus, number>> = {};
        let processed = 0;
        for (const group of grouped) {
          if (group.batchId !== batch.id) continue;
          counts[group.status] = group.count;
          if (group.status !== "queued" && group.status !== "scheduled") {
            processed += group.count;
          }
        }
        return { id: batch.id, total: batch.total, createdAt: batch.createdAt, processed, counts };
      });
    }),
  /**
   * Distinct tag name/value pairs across the user's emails, for the filter
   * picker. Grouped in SQL so the result stays small however many emails
   * carry each tag.
   */
  tags: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.execute<{ name: string; value: string; count: number }>(sql`
      select tag->>'name' as name, tag->>'value' as value, count(*)::int as count
      from ${email}, jsonb_array_elements(${email.tags}) as tag
      where ${email.userId} = ${ctx.session.user.id} and ${email.tags} is not null
      group by 1, 2
      order by 1, 2
      limit 500
    `);
    return rows.rows;
  }),

  /** Email logs, newest first, cursor-paginated by createdAt. */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.coerce.date().optional(),
        status: z.enum(EMAIL_STATUSES).optional(),
        search: z.string().trim().max(320).optional(),
        apiKeyId: z.string().optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
        tag: tagInput.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions: (SQL | undefined)[] = [eq(email.userId, ctx.session.user.id)];
      if (input.tag) conditions.push(tagCondition(input.tag));
      if (input.cursor) conditions.push(lt(email.createdAt, input.cursor));
      if (input.status) conditions.push(eq(email.status, input.status));
      if (input.search) conditions.push(searchCondition(input.search));
      if (input.apiKeyId) conditions.push(eq(email.apiKeyId, input.apiKeyId));
      if (input.from) conditions.push(gte(email.createdAt, input.from));
      if (input.to) conditions.push(lte(email.createdAt, input.to));

      const rows = await db
        .select({
          id: email.id,
          from: email.from,
          to: email.to,
          subject: email.subject,
          status: email.status,
          error: email.error,
          tags: email.tags,
          createdAt: email.createdAt,
          lastEventAt: email.lastEventAt,
        })
        .from(email)
        .where(and(...conditions))
        .orderBy(desc(email.createdAt))
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;
      return {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.createdAt : undefined,
      };
    }),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const [row] = await db
      .select()
      .from(email)
      .where(and(eq(email.id, input.id), eq(email.userId, ctx.session.user.id)));
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Email not found" });

    const events = await db
      .select()
      .from(emailEvent)
      .where(eq(emailEvent.emailId, row.id))
      .orderBy(asc(emailEvent.createdAt));

    return { ...row, events };
  }),
});
