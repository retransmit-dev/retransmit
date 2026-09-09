import { checkPaymentMethod, logRetentionCutoff } from "@retransmit/billing/limits";
import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { SMS_PROVIDER_NAMES, SMS_STATUSES, sms, smsEvent } from "@retransmit/db/schema/sms";
import type { SmsStatus } from "@retransmit/db/schema/sms";
import { enqueueSmsSend } from "@retransmit/queue";
import { detectCountry, normalizePhone, smsSegments } from "@retransmit/sms/phone";
import { providerFamilies, providerLabel, selectProvider } from "@retransmit/sms/provider";
import { DEFAULT_SMS_REGION, SMS_REGIONS, SMS_REGION_IDS } from "@retransmit/sms/regions";
import { SenderNotAllowedError, resolveSender } from "@retransmit/sms/senders";
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, gte, ilike, lt, lte, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import z from "zod";

import {
  assertOrgAdmin,
  assertWithinLimit,
  orgProcedure,
  protectedProcedure,
  router,
} from "../index";

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
   * Message logs, newest first, cursor-paginated by createdAt. Rows older than
   * the plan's log retention are not returned.
   */
  list: orgProcedure
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
      const conditions: (SQL | undefined)[] = [
        eq(sms.userId, ctx.session.user.id),
        gte(sms.createdAt, await logRetentionCutoff(ctx.org.id)),
      ];
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
          requestedProvider: sms.requestedProvider,
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
        // The routing key is opaque (`mtn_cm`); the registry owns its display
        // name, so it is resolved here rather than mirrored in the dashboard.
        items: items.map((row) => ({
          ...row,
          providerName: row.provider ? providerLabel(row.provider) : null,
        })),
        nextCursor: hasMore ? items[items.length - 1]?.createdAt : undefined,
      };
    }),

  get: orgProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const [row] = await db
      .select()
      .from(sms)
      .where(
        and(
          eq(sms.id, input.id),
          eq(sms.userId, ctx.session.user.id),
          gte(sms.createdAt, await logRetentionCutoff(ctx.org.id)),
        ),
      );
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "SMS not found" });

    const events = await db
      .select()
      .from(smsEvent)
      .where(eq(smsEvent.smsId, row.id))
      .orderBy(asc(smsEvent.createdAt));

    return {
      ...row,
      providerName: row.provider ? providerLabel(row.provider) : null,
      events,
    };
  }),

  /**
   * Carriers a send may be pinned to, same names as `provider` on
   * `POST /v1/sms`. No pricing here — that is the operator view
   * (`admin.smsProviders`); this is only what a caller is allowed to name.
   */
  providers: protectedProcedure.query(() => providerFamilies()),

  /**
   * Regions a test send can be forced out of. Same list the sender id form
   * uses; here it exists because sandbox status and the monthly spend limit
   * are per region, so "does this work at all" often has a different answer
   * one region over.
   */
  regions: protectedProcedure.query(() => ({
    regions: SMS_REGIONS,
    defaultRegion: DEFAULT_SMS_REGION,
  })),

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
        /** Pins the send to one carrier; omit to route by country and price. */
        provider: z.enum(SMS_PROVIDER_NAMES).optional(),
        /**
         * Forces the AWS region, for checking a region the normal send path
         * would never pick. Ignored by the direct carrier routes, which have
         * no region.
         */
        region: z.enum(SMS_REGION_IDS).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertOrgAdmin(ctx.org);
      // It goes out over a real carrier and is metered like any other send, so
      // it needs a card exactly as `POST /v1/sms` does.
      assertWithinLimit(
        await checkPaymentMethod(
          ctx.org.id,
          "SMS is billed per message. Add a payment method to send.",
        ),
      );

      const to = normalizePhone(input.to);
      if (!to) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Enter a valid number in international format, e.g. +237670000000",
        });
      }
      const country = detectCountry(to);
      const provider = selectProvider(country, input.provider);
      if (!provider) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: input.provider
            ? `The ${input.provider} provider is not configured for ${country ?? "this destination"}`
            : `No SMS provider is configured for ${country ?? "this destination"}`,
        });
      }

      // Same allowlist the public API enforces, so a test send proves the
      // sender id as well as the route.
      let from: string | null;
      let senderRegion: string | null;
      try {
        ({ from, region: senderRegion } = await resolveSender(ctx.org.id, country, input.from));
      } catch (cause) {
        if (cause instanceof SenderNotAllowedError) {
          throw new TRPCError({ code: "FORBIDDEN", message: cause.message });
        }
        throw cause;
      }

      // A sender id only exists in the region it was registered in, so an
      // override that disagrees would fail at AWS with a resource error that
      // says nothing about the cause. Say it here instead of sending it.
      if (input.region && senderRegion && input.region !== senderRegion) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Sender id "${from}" is registered in ${senderRegion}, so it cannot send from ${input.region}. Drop the sender id to test that region.`,
        });
      }
      const region = input.region ?? senderRegion;

      const id = createId("sms");
      const [created] = await db
        .insert(sms)
        .values({
          id,
          userId: ctx.session.user.id,
          organizationId: ctx.org.id,
          from,
          to: [to],
          text: input.text,
          country,
          region,
          segments: smsSegments(input.text),
          requestedProvider: input.provider,
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
        from,
        region,
        segments: created.segments,
        /**
         * Expected route at enqueue time; the worker picks again when it
         * sends, staying on `requestedProvider` when one was pinned.
         */
        provider: provider.name,
        requestedProvider: input.provider ?? null,
        createdAt: created.createdAt,
      };
    }),
});
