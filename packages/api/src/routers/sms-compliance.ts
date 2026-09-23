import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import {
  SMS_CONSENT_METHODS,
  SMS_PURPOSES,
  SMS_SUPPRESSION_REASONS,
  smsConsent,
  smsSender,
  smsSuppression,
} from "@retransmit/db/schema/sms";
import { allowedSmsCountries } from "@retransmit/sms/compliance";
import { detectCountry, normalizePhone } from "@retransmit/sms/phone";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import z from "zod";

import { assertOrgAdmin, orgProcedure, router } from "../index";

async function ownedApprovedProgram(id: string, organizationId: string) {
  const [program] = await db
    .select()
    .from(smsSender)
    .where(
      and(
        eq(smsSender.id, id),
        eq(smsSender.organizationId, organizationId),
        eq(smsSender.status, "approved"),
      ),
    );
  if (!program) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "SMS program is not approved" });
  }
  return program;
}

function normalizedCameroonPhone(value: string): string {
  const phone = normalizePhone(value);
  if (!phone || detectCountry(phone) !== "CM" || !allowedSmsCountries().has("CM")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Enter a valid Cameroon number in international format, e.g. +237670000000",
    });
  }
  return phone;
}

export const smsComplianceRouter = router({
  programs: orgProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: smsSender.id,
        senderId: smsSender.senderId,
        purposes: smsSender.purposes,
      })
      .from(smsSender)
      .where(
        and(eq(smsSender.organizationId, ctx.org.id), eq(smsSender.status, "approved")),
      )
      .orderBy(desc(smsSender.createdAt));
  }),

  list: orgProcedure.query(async ({ ctx }) => {
    const [consents, suppressions] = await Promise.all([
      db
        .select({
          id: smsConsent.id,
          phone: smsConsent.phone,
          purposes: smsConsent.purposes,
          method: smsConsent.method,
          source: smsConsent.source,
          evidenceUrl: smsConsent.evidenceUrl,
          consentedAt: smsConsent.consentedAt,
          confirmedAt: smsConsent.confirmedAt,
          optedOutAt: smsConsent.optedOutAt,
          senderId: smsSender.senderId,
        })
        .from(smsConsent)
        .innerJoin(smsSender, eq(smsSender.id, smsConsent.smsSenderId))
        .where(eq(smsConsent.organizationId, ctx.org.id))
        .orderBy(desc(smsConsent.consentedAt))
        .limit(500),
      db
        .select()
        .from(smsSuppression)
        .where(eq(smsSuppression.organizationId, ctx.org.id))
        .orderBy(desc(smsSuppression.createdAt))
        .limit(500),
    ]);
    return { consents, suppressions };
  }),

  record: orgProcedure
    .input(
      z.object({
        smsSenderId: z.string(),
        phone: z.string(),
        purposes: z.array(z.enum(SMS_PURPOSES)).min(1),
        method: z.enum(SMS_CONSENT_METHODS),
        source: z.string().trim().min(3).max(500),
        disclosureText: z.string().trim().min(20).max(4000),
        evidenceUrl: z.url({ protocol: /^https$/ }).max(1000).optional(),
        consentedAt: z.coerce.date().optional(),
        confirmedAt: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertOrgAdmin(ctx.org);
      const program = await ownedApprovedProgram(input.smsSenderId, ctx.org.id);
      const invalidPurpose = input.purposes.find((purpose) => !program.purposes.includes(purpose));
      if (invalidPurpose) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${invalidPurpose} is not approved for ${program.senderId}`,
        });
      }
      const phone = normalizedCameroonPhone(input.phone);
      const [consent] = await db
        .insert(smsConsent)
        .values({
          id: createId("scn"),
          organizationId: ctx.org.id,
          smsSenderId: program.id,
          phone,
          purposes: [...new Set(input.purposes)],
          method: input.method,
          source: input.source,
          disclosureText: input.disclosureText,
          evidenceUrl: input.evidenceUrl ?? null,
          consentedAt: input.consentedAt ?? new Date(),
          confirmedAt: input.confirmedAt ?? null,
          optedOutAt: null,
        })
        .onConflictDoUpdate({
          target: [smsConsent.organizationId, smsConsent.smsSenderId, smsConsent.phone],
          set: {
            purposes: [...new Set(input.purposes)],
            method: input.method,
            source: input.source,
            disclosureText: input.disclosureText,
            evidenceUrl: input.evidenceUrl ?? null,
            consentedAt: input.consentedAt ?? new Date(),
            confirmedAt: input.confirmedAt ?? null,
            optedOutAt: null,
          },
        })
        .returning();
      await db
        .delete(smsSuppression)
        .where(
          and(
            eq(smsSuppression.organizationId, ctx.org.id),
            eq(smsSuppression.phone, phone),
          ),
        );
      return consent!;
    }),

  optOut: orgProcedure
    .input(
      z.object({
        phone: z.string(),
        reason: z.enum(SMS_SUPPRESSION_REASONS).default("opt_out"),
        source: z.string().trim().min(3).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertOrgAdmin(ctx.org);
      const phone = normalizedCameroonPhone(input.phone);
      const now = new Date();
      const [suppression] = await db
        .insert(smsSuppression)
        .values({
          id: createId("ssp"),
          organizationId: ctx.org.id,
          phone,
          reason: input.reason,
          source: input.source,
        })
        .onConflictDoUpdate({
          target: [smsSuppression.organizationId, smsSuppression.phone],
          set: { reason: input.reason, source: input.source },
        })
        .returning();
      await db
        .update(smsConsent)
        .set({ optedOutAt: now })
        .where(and(eq(smsConsent.organizationId, ctx.org.id), eq(smsConsent.phone, phone)));
      return suppression!;
    }),
});
