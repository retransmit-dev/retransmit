import { db } from "@retransmit/db";
import { email, emailEvent } from "@retransmit/db/schema/email";
import { EMAIL_STATUSES } from "@retransmit/db/schema/email";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, lt } from "drizzle-orm";
import z from "zod";

import { protectedProcedure, router } from "../index";

export const emailRouter = router({
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
