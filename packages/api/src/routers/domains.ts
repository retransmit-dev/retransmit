import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { domain } from "@retransmit/db/schema/email";
import { DOMAIN_NAME_REGEX } from "@retransmit/email/address";
import { DEFAULT_SES_REGION, SES_REGIONS, SES_REGION_IDS } from "@retransmit/email/regions";
import {
  createDomainIdentity,
  deleteDomainIdentity,
  dnsRecordsForDomain,
  getDomainIdentity,
} from "@retransmit/email/ses";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import z from "zod";

import { assertOrgAdmin, orgProcedure, router } from "../index";

/** One DNS label: the `mail` in `mail.example.com`. */
const RETURN_PATH_LABEL_REGEX = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

async function findOwnedDomain(id: string, organizationId: string) {
  const [row] = await db
    .select()
    .from(domain)
    .where(and(eq(domain.id, id), eq(domain.organizationId, organizationId)));
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
  return row;
}

function withDnsRecords<T extends Parameters<typeof dnsRecordsForDomain>[0]>(row: T) {
  return { ...row, dnsRecords: dnsRecordsForDomain(row) };
}

export const domainRouter = router({
  /** Regions a domain can be verified into, with the default pre-selected. */
  regions: orgProcedure.query(() => ({
    regions: SES_REGIONS,
    defaultRegion: DEFAULT_SES_REGION,
  })),

  list: orgProcedure.query(async ({ ctx }) => {
    return await db
      .select()
      .from(domain)
      .where(eq(domain.organizationId, ctx.org.id))
      .orderBy(desc(domain.createdAt));
  }),

  get: orgProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return withDnsRecords(await findOwnedDomain(input.id, ctx.org.id));
  }),

  create: orgProcedure
    .input(
      z.object({
        name: z
          .string()
          .trim()
          .toLowerCase()
          .regex(DOMAIN_NAME_REGEX, "Enter a valid domain, e.g. mail.example.com"),
        region: z.enum(SES_REGION_IDS),
        /**
         * Subdomain label for the custom Return-Path (MAIL FROM) domain.
         * SES requires it to be a subdomain of the sending domain, so the
         * root domain itself is not accepted.
         */
        returnPath: z
          .string()
          .trim()
          .toLowerCase()
          .regex(RETURN_PATH_LABEL_REGEX, "Use letters, digits and hyphens only, e.g. mail")
          .default("mail"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db.select().from(domain).where(eq(domain.name, input.name));
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            existing.organizationId === ctx.org.id
              ? "Your organization already added this domain"
              : "This domain is already registered",
        });
      }

      const mailFromDomain = `${input.returnPath}.${input.name}`;
      const { dkimTokens } = await createDomainIdentity(input.name, {
        region: input.region,
        mailFromDomain,
      });
      // The identity may already be verified in SES (e.g. re-adding a
      // known domain) — pick that up right away instead of waiting for
      // a manual verify.
      const identity = await getDomainIdentity(input.name, input.region).catch(() => null);
      const status = identity?.status ?? "pending";
      const [created] = await db
        .insert(domain)
        .values({
          id: createId("dom"),
          userId: ctx.session.user.id,
          organizationId: ctx.org.id,
          name: input.name,
          region: input.region,
          dkimTokens,
          mailFromDomain,
          mailFromStatus: identity?.mailFromStatus ?? "pending",
          status,
          verifiedAt: status === "verified" ? new Date() : null,
        })
        .returning();
      if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return withDnsRecords(created);
    }),

  /** Re-checks verification status with SES and stores the result. */
  verify: orgProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const row = await findOwnedDomain(input.id, ctx.org.id);
      const identity = await getDomainIdentity(row.name, row.region);
      const [updated] = await db
        .update(domain)
        .set({
          status: identity.status,
          dkimTokens: identity.dkimTokens.length > 0 ? identity.dkimTokens : row.dkimTokens,
          // Rows from before return paths existed have no MAIL FROM domain;
          // keep them that way rather than inventing one.
          mailFromStatus: row.mailFromDomain ? identity.mailFromStatus : null,
          verifiedAt:
            identity.status === "verified" ? (row.verifiedAt ?? new Date()) : row.verifiedAt,
        })
        .where(eq(domain.id, row.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return withDnsRecords(updated);
    }),

  delete: orgProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertOrgAdmin(ctx.org);
      const row = await findOwnedDomain(input.id, ctx.org.id);
      await deleteDomainIdentity(row.name, row.region);
      await db.delete(domain).where(eq(domain.id, row.id));
      return { id: row.id };
    }),
});
