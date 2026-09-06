import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { SMS_STATUSES, sms, smsEvent } from "@retransmit/db/schema/sms";
import type { SmsStatus } from "@retransmit/db/schema/sms";
import { enqueueSmsSend } from "@retransmit/queue";
import { detectCountry, normalizePhone, smsSegments } from "@retransmit/sms/phone";
import { providerSummaries, selectProvider } from "@retransmit/sms/provider";
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, gte, ilike, lt, lte, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import z from "zod";

import { assertOrgAdmin, orgProcedure, protectedProcedure, router } from "../index";

/** Case-insensitive match on recipient, sender id or body. */
function searchCondition(search: string) {
  const escaped = search.trim().toLowerCase().replace(/[%_\\]/g, "\\$&");
  const pattern = `%${escaped}%`;
  return or(
    ilike(sms.text, pattern),
    ilike(sms.from, pattern),
    // `to` is a jsonb array of numbers; matching its text form covers every recipient.
    sql`${sms.to}::text ilike ${pattern}`,
  );
}

const senderId = z
  .string()
  .trim()
  .min(1)
  .max(11)
  .regex(/^[a-zA-Z0-9 _-]+$/, "Sender id may only contain letters, digits, space, - and _");

export const smsRouter = router({
  /** Live counts of the user's messages per status. */
  stats: protectedProcedure.query(async ({ ctx }) => {
    const grouped = await db
      .select({ status: sms.status, count: count() })
      .from(sms)
      .where(eq(sms.userId, ctx.session.user.id))
      .groupBy(sms.status);

    const counts = Object.fromEntries(SMS_STATUSES.map((status) => [status, 0])) as Record<
      SmsStatus,
      number
    >;
    let total = 0;
    for (const row of grouped) {
      counts[row.status] = row.count;
      total += row.count;
    }
    return { counts, total };
  }),

  /**
   * Every provider the deployment knows about and whether it has credentials.
   * Routing itself stays server-side; this only explains why a destination
   * may be unroutable.
   */
  providers: protectedProcedure.query(() => providerSummaries()),

  /** Message logs, newest first, cursor-paginated by createdAt. */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.coerce.date().optional(),
        status: z.enum(SMS_STATUSES).optional(),
        search: z.string().trim().max(320).optional(),
        apiKeyId: z.string().optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions: (SQL | undefined)[] = [eq(sms.userId, ctx.session.user.id)];
      if (input.cursor) conditions.push(lt(sms.createdAt, input.cursor));
      if (input.status) conditions.push(eq(sms.status, input.status));
      if (input.search) conditions.push(searchCondition(input.search));
      if (input.apiKeyId) conditions.push(eq(sms.apiKeyId, input.apiKeyId));
      if (input.from) conditions.push(gte(sms.createdAt, input.from));
      if (input.to) conditions.push(lte(sms.createdAt, input.to));

      const rows = await db
        .select({
          id: sms.id,
          from: sms.from,
          to: sms.to,
          text: sms.text,
          country: sms.country,
          segments: sms.segments,
          provider: sms.provider,
          status: sms.status,
          error: sms.error,
          createdAt: sms.createdAt,
          lastEventAt: sms.lastEventAt,
        })
        .from(sms)
        .where(and(...conditions))
        .orderBy(desc(sms.createdAt))
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
      .from(sms)
      .where(and(eq(sms.id, input.id), eq(sms.userId, ctx.session.user.id)));
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "SMS not found" });

    const events = await db
      .select()
      .from(smsEvent)
      .where(eq(smsEvent.smsId, row.id))
      .orderBy(asc(smsEvent.createdAt));

    return { ...row, events };
  }),

  /**
   * Queues one message through the same path as `POST /v1/sms`, minus the
   * API key: the row is owned by the signed-in user, routed at send time and
   * shows up in the log like any other. For checking a provider end to end.
   */
  sendTest: orgProcedure
    .input(
      z.object({
        from: senderId.optional(),
        to: z.string().trim().min(5),
        text: z.string().min(1).max(1600),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertOrgAdmin(ctx.org);

      const to = normalizePhone(input.to);
      if (!to) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Enter the number in international format, e.g. +237670000000",
        });
      }
      const country = detectCountry(to);
      const provider = selectProvider(country);
      if (!provider) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `No SMS provider is configured for ${country ?? "this destination"}`,
        });
      }

      const id = createId("sms");
      const [created] = await db
        .insert(sms)
        .values({
          id,
          userId: ctx.session.user.id,
          organizationId: ctx.org.id,
          from: input.from,
          to: [to],
          text: input.text,
          country,
          segments: smsSegments(input.text),
        })
        .returning();
      if (!created) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create SMS" });
      }

      await enqueueSmsSend(id);

      return {
        id,
        to,
        country,
        segments: created.segments,
        /** Expected route at enqueue time; the worker picks again when it sends. */
        provider: provider.key,
        createdAt: created.createdAt,
      };
    }),
});
