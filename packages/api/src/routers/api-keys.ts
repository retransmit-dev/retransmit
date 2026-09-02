import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { apiKey } from "@retransmit/db/schema/email";
import { generateApiKey } from "@retransmit/email/api-keys";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import z from "zod";

import { protectedProcedure, router } from "../index";

export const apiKeyRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return await db
      .select({
        id: apiKey.id,
        name: apiKey.name,
        keyHint: apiKey.keyHint,
        lastUsedAt: apiKey.lastUsedAt,
        revokedAt: apiKey.revokedAt,
        createdAt: apiKey.createdAt,
      })
      .from(apiKey)
      .where(eq(apiKey.userId, ctx.session.user.id))
      .orderBy(desc(apiKey.createdAt));
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const generated = generateApiKey();
      const [created] = await db
        .insert(apiKey)
        .values({
          id: createId("key"),
          userId: ctx.session.user.id,
          name: input.name,
          keyHash: generated.keyHash,
          keyHint: generated.keyHint,
        })
        .returning();
      if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // The full key is returned exactly once and never persisted.
      return {
        id: created.id,
        name: created.name,
        keyHint: created.keyHint,
        key: generated.key,
      };
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [revoked] = await db
        .update(apiKey)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(apiKey.id, input.id),
            eq(apiKey.userId, ctx.session.user.id),
            isNull(apiKey.revokedAt),
          ),
        )
        .returning({ id: apiKey.id });
      if (!revoked) throw new TRPCError({ code: "NOT_FOUND" });
      return revoked;
    }),
});
