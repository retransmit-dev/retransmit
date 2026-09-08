import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { organization } from "@retransmit/db/schema/auth";
import { smsSender } from "@retransmit/db/schema/sms";
import {
  SENDER_ID_COUNTRY_CODES,
  SMS_COUNTRIES,
  UNSUPPORTED_REASON,
} from "@retransmit/sms/countries";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import z from "zod";

import { adminProcedure, assertOrgAdmin, orgProcedure, router } from "../index";

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
  .transform((values) => [...new Set(values)]);

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
    countries: SMS_COUNTRIES,
    unsupportedReason: UNSUPPORTED_REASON,
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
      z.object({
        senderId: senderIdSchema,
        countries: countriesSchema,
        useCase: z.string().trim().min(10, "Describe what you send").max(500),
        sampleMessage: z.string().trim().min(10, "Paste a representative message").max(500),
        companyName: z.string().trim().min(2).max(200),
        companyWebsite: z.url("Enter a full URL, e.g. https://example.com").max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertOrgAdmin(ctx.org);

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
          useCase: input.useCase,
          sampleMessage: input.sampleMessage,
          companyName: input.companyName,
          companyWebsite: input.companyWebsite ?? null,
        })
        .returning();
      if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return created;
    }),

  /**
   * Withdraws a request. Approved rows can go too: the send path then falls
   * back to the provider default for that country, and the upstream
   * registration is cleaned up by the operator.
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
        status: smsSender.status,
        useCase: smsSender.useCase,
        sampleMessage: smsSender.sampleMessage,
        companyName: smsSender.companyName,
        companyWebsite: smsSender.companyWebsite,
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

      const [updated] = await db
        .update(smsSender)
        .set({
          status: input.status,
          countries: input.countries ? [...new Set(input.countries)] : row.countries,
          registrationId: input.registrationId ?? row.registrationId,
          reviewNote: input.note ?? null,
          reviewedAt: new Date(),
          reviewedBy: ctx.session.user.email,
        })
        .where(eq(smsSender.id, row.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return updated;
    }),
});
