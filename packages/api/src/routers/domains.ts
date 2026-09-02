import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { domain } from "@retransmit/db/schema/email";
import { DOMAIN_NAME_REGEX } from "@retransmit/email/address";
import {
  createDomainIdentity,
  deleteDomainIdentity,
  dnsRecordsForDomain,
  getDomainIdentity,
  sesRegion,
} from "@retransmit/email/ses";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import z from "zod";

import { protectedProcedure, router } from "../index";

async function findOwnedDomain(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(domain)
    .where(and(eq(domain.id, id), eq(domain.userId, userId)));
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
  return row;
}

export const domainRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return await db
      .select()
      .from(domain)
      .where(eq(domain.userId, ctx.session.user.id))
      .orderBy(desc(domain.createdAt));
  }),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const row = await findOwnedDomain(input.id, ctx.session.user.id);
    return { ...row, dnsRecords: dnsRecordsForDomain(row.name, row.dkimTokens) };
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z
          .string()
          .trim()
          .toLowerCase()
          .regex(DOMAIN_NAME_REGEX, "Enter a valid domain, e.g. mail.example.com"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db.select().from(domain).where(eq(domain.name, input.name));
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            existing.userId === ctx.session.user.id
              ? "You already added this domain"
              : "This domain is already registered",
        });
      }

      const { dkimTokens } = await createDomainIdentity(input.name);
      const [created] = await db
        .insert(domain)
        .values({
          id: createId("dom"),
          userId: ctx.session.user.id,
          name: input.name,
          region: sesRegion,
          dkimTokens,
        })
        .returning();
      if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { ...created, dnsRecords: dnsRecordsForDomain(created.name, created.dkimTokens) };
    }),

  /** Re-checks verification status with SES and stores the result. */
  verify: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const row = await findOwnedDomain(input.id, ctx.session.user.id);
      const { status, dkimTokens } = await getDomainIdentity(row.name);
      const [updated] = await db
        .update(domain)
        .set({
          status,
          dkimTokens: dkimTokens.length > 0 ? dkimTokens : row.dkimTokens,
          verifiedAt: status === "verified" ? (row.verifiedAt ?? new Date()) : row.verifiedAt,
        })
        .where(eq(domain.id, row.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { ...updated, dnsRecords: dnsRecordsForDomain(updated.name, updated.dkimTokens) };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const row = await findOwnedDomain(input.id, ctx.session.user.id);
      await deleteDomainIdentity(row.name);
      await db.delete(domain).where(eq(domain.id, row.id));
      return { id: row.id };
    }),
});
