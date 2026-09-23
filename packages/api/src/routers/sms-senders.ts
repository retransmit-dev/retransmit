import { checkPaymentMethod } from "@retransmit/billing/limits";
import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { organization } from "@retransmit/db/schema/auth";
import { SMS_PURPOSES, smsSender } from "@retransmit/db/schema/sms";
import {
  SENDER_ID_COUNTRY_CODES,
  SMS_COUNTRIES,
  UNSUPPORTED_REASON,
} from "@retransmit/sms/countries";
import { allowedSmsCountries } from "@retransmit/sms/compliance";
import { DEFAULT_SMS_REGION, SMS_REGIONS } from "@retransmit/sms/regions";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import z from "zod";

import { adminProcedure, assertOrgAdmin, assertWithinLimit, orgProcedure, router } from "../index";

/**
 * Sender ids: the one thing a customer must set up before SMS reaches a
 * handset with their name on it. Carriers own the approval, so the customer
 * files a request here and an operator (see the admin procedures below)
 * registers it upstream and flips the status. Nothing about providers,
 * credentials or AWS is exposed — that stays platform-side, so one API key
 * still covers every channel.
 */

/** Alphanumeric sender id: at most 11 characters, as GSM allows. */
const senderIdSchema = z
  .string()
  .trim()
  .min(3, "Use at least 3 characters")
  .max(11, "Sender ids are at most 11 characters")
  .regex(/^[A-Za-z0-9][A-Za-z0-9 _-]*$/, "Letters, digits, space, - and _ only, starting with a letter or digit");

const countriesSchema = z
  .array(z.enum(SENDER_ID_COUNTRY_CODES))
  .min(1, "Pick at least one country")
  .max(SMS_COUNTRIES.length)
  .refine((values) => values.every((country) => allowedSmsCountries().has(country)), {
    message: "SMS production access is currently limited to Cameroon",
  })
  .transform((values) => [...new Set(values)]);

const publicUrl = z.url({ protocol: /^https$/ }).max(500);

async function findOwnedSender(id: string, organizationId: string) {
  const [row] = await db
    .select()
    .from(smsSender)
    .where(and(eq(smsSender.id, id), eq(smsSender.organizationId, organizationId)));
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Sender id not found" });
  return row;
}

export const smsSenderRouter = router({
  /**
   * Destinations a sender id can be requested for, with the ones that need a
   * number instead marked so the form can disable them with the reason.
   */
  countries: orgProcedure.query(() => ({
    countries: SMS_COUNTRIES.filter((country) => allowedSmsCountries().has(country.code)),
    unsupportedReason: UNSUPPORTED_REASON,
  })),

  /**
   * Regions a sender id can be registered in, with the default pre-selected.
   * The region is part of the request rather than something we pick later
   * because the registration itself happens in one region: a name approved in
   * Frankfurt cannot send from Cape Town.
   */
  regions: orgProcedure.query(() => ({
    regions: SMS_REGIONS.filter((region) => region.id === "af-south-1"),
    defaultRegion: allowedSmsCountries().has("CM") ? "af-south-1" : DEFAULT_SMS_REGION,
  })),

  list: orgProcedure.query(async ({ ctx }) => {
    return await db
      .select()
      .from(smsSender)
      .where(eq(smsSender.organizationId, ctx.org.id))
      .orderBy(desc(smsSender.createdAt));
  }),

  /**
   * Files a request. It lands as `pending`: registration is a carrier
   * process measured in days, so there is nothing to send with yet.
   */
  create: orgProcedure
    .input(
      z
        .object({
          senderId: senderIdSchema,
          countries: countriesSchema,
          region: z.literal("af-south-1").default("af-south-1"),
          useCase: z.string().trim().min(30).max(1000),
          sampleMessage: z.string().trim().min(20).max(1000),
          companyName: z.string().trim().min(2).max(200),
          companyWebsite: publicUrl,
          optInUrl: publicUrl,
          privacyUrl: publicUrl,
          termsUrl: publicUrl,
          supportEmail: z.string().trim().email().max(320),
          optOutText: z.string().trim().min(10).max(160),
          purposes: z.array(z.enum(SMS_PURPOSES)).min(1).max(SMS_PURPOSES.length),
          expectedDailyVolume: z.number().int().min(1).max(100_000),
          expectedMonthlyVolume: z.number().int().min(1).max(3_000_000),
        }),
    )
    .mutation(async ({ ctx, input }) => {
      assertOrgAdmin(ctx.org);
      // A registration is filed with a carrier and takes days to undo, so the
      // card comes first. Nothing here is billed, but a sender id has no use
      // except sending SMS, which is.
      assertWithinLimit(
        await checkPaymentMethod(
          ctx.org.id,
          "SMS is billed per message. Add a payment method before requesting a sender id.",
        ),
      );

      const [existing] = await db
        .select()
        .from(smsSender)
        .where(
          and(eq(smsSender.organizationId, ctx.org.id), eq(smsSender.senderId, input.senderId)),
        );
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            existing.status === "rejected"
              ? `"${input.senderId}" was rejected. Delete it before requesting it again.`
              : `"${input.senderId}" is already ${existing.status} for your organization`,
        });
      }

      const [created] = await db
        .insert(smsSender)
        .values({
          id: createId("snd"),
          organizationId: ctx.org.id,
          userId: ctx.session.user.id,
          senderId: input.senderId,
          countries: input.countries,
          region: input.region,
          useCase: input.useCase,
          sampleMessage: input.sampleMessage,
          companyName: input.companyName,
          companyWebsite: input.companyWebsite,
          optInUrl: input.optInUrl,
          privacyUrl: input.privacyUrl,
          termsUrl: input.termsUrl,
          supportEmail: input.supportEmail,
          optOutText: input.optOutText,
          purposes: [...new Set(input.purposes)],
          expectedDailyVolume: input.expectedDailyVolume,
          expectedMonthlyVolume: input.expectedMonthlyVolume,
        })
        .returning();
      if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return created;
    }),

  /**
   * Withdraws a request. Approved rows can go too: the send path then blocks
   * that program, and the operator can clean up its upstream registration.
   */
  delete: orgProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertOrgAdmin(ctx.org);
      const row = await findOwnedSender(input.id, ctx.org.id);
      await db.delete(smsSender).where(eq(smsSender.id, row.id));
      return { id: row.id };
    }),

  /* -- Operator surface -------------------------------------------------- */

  /**
   * Every request across every organization, pending first — the operator's
   * queue. Carries the organization name so a registration can be filed
   * without a second lookup.
   */
  queue: adminProcedure.query(async () => {
    return await db
      .select({
        id: smsSender.id,
        senderId: smsSender.senderId,
        countries: smsSender.countries,
        region: smsSender.region,
        status: smsSender.status,
        useCase: smsSender.useCase,
        sampleMessage: smsSender.sampleMessage,
        companyName: smsSender.companyName,
        companyWebsite: smsSender.companyWebsite,
        optInUrl: smsSender.optInUrl,
        privacyUrl: smsSender.privacyUrl,
        termsUrl: smsSender.termsUrl,
        supportEmail: smsSender.supportEmail,
        optOutText: smsSender.optOutText,
        purposes: smsSender.purposes,
        expectedDailyVolume: smsSender.expectedDailyVolume,
        expectedMonthlyVolume: smsSender.expectedMonthlyVolume,
        dailyLimit: smsSender.dailyLimit,
        monthlyLimit: smsSender.monthlyLimit,
        recipientDailyLimit: smsSender.recipientDailyLimit,
        registrationId: smsSender.registrationId,
        reviewNote: smsSender.reviewNote,
        reviewedAt: smsSender.reviewedAt,
        createdAt: smsSender.createdAt,
        organizationId: smsSender.organizationId,
        organizationName: organization.name,
      })
      .from(smsSender)
      .leftJoin(organization, eq(organization.id, smsSender.organizationId))
      // Pending first, then newest: the queue is a worklist, not a log.
      // Explicit ordering because alphabetically "approved" would come first.
      .orderBy(sql`case ${smsSender.status} when 'pending' then 0 else 1 end`, desc(smsSender.createdAt));
  }),

  /**
   * Records the outcome of an upstream registration. Approving is what makes
   * the sender id usable, so `registrationId` is asked for alongside it —
   * an approval with no upstream reference is how a sender id ends up
   * working in the dashboard and failing at the carrier.
   */
  review: adminProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["approved", "rejected"]),
        registrationId: z.string().trim().max(200).optional(),
        note: z.string().trim().max(1000).optional(),
        /** Narrows an approval to the countries the carriers actually cleared. */
        countries: z.array(z.enum(SENDER_ID_COUNTRY_CODES)).min(1).optional(),
        /**
         * Corrects the region when the registration was filed somewhere other
         * than the customer asked for. The row has to name where the
         * origination identity actually lives, or every send using it fails.
         */
        region: z.literal("af-south-1").optional(),
        dailyLimit: z.number().int().min(1).max(100_000).optional(),
        monthlyLimit: z.number().int().min(1).max(3_000_000).optional(),
        recipientDailyLimit: z.number().int().min(1).max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await db.select().from(smsSender).where(eq(smsSender.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Sender id not found" });

      if (input.status === "rejected" && !input.note) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A rejection needs a reason; the customer reads it",
        });
      }
      if (
        input.status === "approved" &&
        (!input.dailyLimit || !input.monthlyLimit || !input.recipientDailyLimit)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An approval needs daily, monthly, and per-recipient limits",
        });
      }

      const [updated] = await db
        .update(smsSender)
        .set({
          status: input.status,
          countries: input.countries ? [...new Set(input.countries)] : row.countries,
          region: input.region ?? row.region,
          registrationId: input.registrationId ?? row.registrationId,
          reviewNote: input.note ?? null,
          reviewedAt: new Date(),
          reviewedBy: ctx.session.user.email,
          dailyLimit: input.status === "approved" ? input.dailyLimit : null,
          monthlyLimit: input.status === "approved" ? input.monthlyLimit : null,
          recipientDailyLimit: input.status === "approved" ? input.recipientDailyLimit : null,
        })
        .where(eq(smsSender.id, row.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return updated;
    }),
});
