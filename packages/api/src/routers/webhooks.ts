import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { WEBHOOK_EVENT_TYPES, webhookDelivery, webhookEndpoint } from "@retransmit/db/schema/email";
import { generateWebhookSecret } from "@retransmit/email/webhooks";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import z from "zod";

import { protectedProcedure, router } from "../index";

const eventTypesSchema = z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1);

async function findOwnedEndpoint(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(webhookEndpoint)
    .where(and(eq(webhookEndpoint.id, id), eq(webhookEndpoint.userId, userId)));
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Webhook endpoint not found" });
  return row;
}

export const webhookRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return await db
      .select({
        id: webhookEndpoint.id,
        url: webhookEndpoint.url,
        eventTypes: webhookEndpoint.eventTypes,
        enabled: webhookEndpoint.enabled,
        createdAt: webhookEndpoint.createdAt,
      })
      .from(webhookEndpoint)
      .where(eq(webhookEndpoint.userId, ctx.session.user.id))
      .orderBy(desc(webhookEndpoint.createdAt));
  }),

  create: protectedProcedure
    .input(z.object({ url: z.url({ protocol: /^https?$/ }), eventTypes: eventTypesSchema }))
    .mutation(async ({ ctx, input }) => {
      const [created] = await db
        .insert(webhookEndpoint)
        .values({
          id: createId("wh"),
          userId: ctx.session.user.id,
          url: input.url,
          secret: generateWebhookSecret(),
          eventTypes: input.eventTypes,
        })
        .returning();
      if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // The secret is shown once so the consumer can verify signatures.
      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        url: z.url({ protocol: /^https?$/ }).optional(),
        eventTypes: eventTypesSchema.optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await findOwnedEndpoint(input.id, ctx.session.user.id);
      const [updated] = await db
        .update(webhookEndpoint)
        .set({
          url: input.url ?? row.url,
          eventTypes: input.eventTypes ?? row.eventTypes,
          enabled: input.enabled ?? row.enabled,
        })
        .where(eq(webhookEndpoint.id, row.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const row = await findOwnedEndpoint(input.id, ctx.session.user.id);
      await db.delete(webhookEndpoint).where(eq(webhookEndpoint.id, row.id));
      return { id: row.id };
    }),

  deliveries: protectedProcedure
    .input(z.object({ endpointId: z.string(), limit: z.number().int().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      await findOwnedEndpoint(input.endpointId, ctx.session.user.id);
      return await db
        .select()
        .from(webhookDelivery)
        .where(eq(webhookDelivery.endpointId, input.endpointId))
        .orderBy(desc(webhookDelivery.createdAt))
        .limit(input.limit);
    }),
});
