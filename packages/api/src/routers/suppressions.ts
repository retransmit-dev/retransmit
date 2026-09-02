import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { suppression, SUPPRESSION_REASONS } from "@retransmit/db/schema/email";
import type { SuppressionReason } from "@retransmit/db/schema/email";
import { extractEmailAddress } from "@retransmit/email/address";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, ilike, inArray } from "drizzle-orm";
import z from "zod";

import { assertOrgAdmin, orgProcedure, router } from "../index";

const reasonSchema = z.enum(SUPPRESSION_REASONS);

const IMPORT_MAX = 10_000;
const INSERT_CHUNK = 1_000;

/** Normalizes to a bare, lowercased address; null if invalid. */
function normalizeAddress(value: string): string | null {
  const address = extractEmailAddress(value.trim());
  return address ? address.toLowerCase() : null;
}

function searchCondition(search: string) {
  const escaped = search.trim().toLowerCase().replace(/[%_\\]/g, "\\$&");
  return ilike(suppression.email, `%${escaped}%`);
}

async function insertEntries(
  organizationId: string,
  createdByUserId: string,
  entries: { email: string; reason: SuppressionReason }[],
): Promise<{ added: number; skipped: number }> {
  const seen = new Set<string>();
  const rows: (typeof suppression.$inferInsert)[] = [];
  for (const entry of entries) {
    const address = normalizeAddress(entry.email);
    if (!address) continue;
    if (seen.has(address)) continue;
    seen.add(address);
    rows.push({
      id: createId("sup"),
      organizationId,
      email: address,
      reason: entry.reason,
      createdByUserId,
    });
  }

  let added = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const inserted = await db
      .insert(suppression)
      .values(rows.slice(i, i + INSERT_CHUNK))
      .onConflictDoNothing({ target: [suppression.organizationId, suppression.email] })
      .returning({ id: suppression.id });
    added += inserted.length;
  }
  // Skipped covers invalid addresses, in-payload duplicates, and addresses
  // already on the list.
  return { added, skipped: entries.length - added };
}

export const suppressionRouter = router({
  list: orgProcedure
    .input(
      z.object({
        search: z.string().trim().max(320).optional(),
        reason: reasonSchema.optional(),
        limit: z.number().int().min(1).max(500).default(100),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(suppression.organizationId, ctx.org.id)];
      if (input.reason) conditions.push(eq(suppression.reason, input.reason));
      if (input.search) conditions.push(searchCondition(input.search));
      const where = and(...conditions);

      const [rows, [totalRow]] = await Promise.all([
        db
          .select({
            id: suppression.id,
            email: suppression.email,
            reason: suppression.reason,
            createdAt: suppression.createdAt,
          })
          .from(suppression)
          .where(where)
          .orderBy(desc(suppression.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ total: count() }).from(suppression).where(where),
      ]);

      return { rows, total: totalRow?.total ?? 0 };
    }),

  stats: orgProcedure.query(async ({ ctx }) => {
    const grouped = await db
      .select({ reason: suppression.reason, count: count() })
      .from(suppression)
      .where(eq(suppression.organizationId, ctx.org.id))
      .groupBy(suppression.reason);

    const stats = { total: 0, bounce: 0, complaint: 0, manual: 0, unsubscribe: 0 };
    for (const row of grouped) {
      stats[row.reason] = row.count;
      stats.total += row.count;
    }
    return stats;
  }),

  add: orgProcedure
    .input(z.object({ emails: z.array(z.string().trim().min(3).max(320)).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      assertOrgAdmin(ctx.org);
      const invalid = input.emails.filter((value) => normalizeAddress(value) === null);
      if (invalid.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Not a valid email address: ${invalid[0]}`,
        });
      }
      return await insertEntries(
        ctx.org.id,
        ctx.session.user.id,
        input.emails.map((email) => ({ email, reason: "manual" as const })),
      );
    }),

  /**
   * Bulk import, e.g. a suppression list exported from another provider.
   * Invalid rows are skipped rather than failing the whole import.
   */
  import: orgProcedure
    .input(
      z.object({
        entries: z
          .array(
            z.object({
              email: z.string().trim().min(3).max(320),
              reason: reasonSchema.default("manual"),
            }),
          )
          .min(1)
          .max(IMPORT_MAX),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertOrgAdmin(ctx.org);
      return await insertEntries(ctx.org.id, ctx.session.user.id, input.entries);
    }),

  remove: orgProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      assertOrgAdmin(ctx.org);
      const removed = await db
        .delete(suppression)
        .where(
          and(eq(suppression.organizationId, ctx.org.id), inArray(suppression.id, input.ids)),
        )
        .returning({ id: suppression.id });
      return { removed: removed.length };
    }),

  /** Everything on the list, for CSV export. */
  exportAll: orgProcedure.query(async ({ ctx }) => {
    return await db
      .select({
        email: suppression.email,
        reason: suppression.reason,
        createdAt: suppression.createdAt,
      })
      .from(suppression)
      .where(eq(suppression.organizationId, ctx.org.id))
      .orderBy(desc(suppression.createdAt))
      .limit(100_000);
  }),
});
