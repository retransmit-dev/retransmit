import { db } from "@retransmit/db";
import { email, emailBatch, emailEvent } from "@retransmit/db/schema/email";
import { EMAIL_STATUSES } from "@retransmit/db/schema/email";
import type { EmailStatus } from "@retransmit/db/schema/email";
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, inArray, lt } from "drizzle-orm";
import z from "zod";

import { protectedProcedure, router } from "../index";

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
  /** Email logs, newest first, cursor-paginated by createdAt. */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.coerce.date().optional(),
        status: z.enum(EMAIL_STATUSES).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(email.userId, ctx.session.user.id)];
      if (input.cursor) conditions.push(lt(email.createdAt, input.cursor));
      if (input.status) conditions.push(eq(email.status, input.status));

      const rows = await db
        .select({
          id: email.id,
          from: email.from,
          to: email.to,
          subject: email.subject,
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
