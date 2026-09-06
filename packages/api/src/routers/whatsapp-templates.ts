import { db } from "@retransmit/db";
import { whatsappAccount, whatsappTemplate } from "@retransmit/db/schema/whatsapp";
import {
  createTemplate,
  deleteTemplate,
  syncTemplates,
  templateDraftSchema,
} from "@retransmit/whatsapp/templates";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import z from "zod";

import { assertOrgAdmin, orgProcedure, router } from "../index";

/**
 * The connected number whose credentials manage templates on a WABA. Any
 * active number on that WABA will do; `accountId` picks one explicitly.
 */
async function findManagingAccount(organizationId: string, accountId?: string) {
  const rows = await db
    .select()
    .from(whatsappAccount)
    .where(eq(whatsappAccount.organizationId, organizationId));
  const active = rows.filter((row) => row.status === "active");
  const match = accountId ? active.find((row) => row.id === accountId) : active[0];
  if (!match) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: accountId
        ? "That WhatsApp number is not connected"
        : "Connect a WhatsApp number before creating templates",
    });
  }
  return match;
}

async function findOwnedTemplate(id: string, organizationId: string) {
  const [row] = await db
    .select()
    .from(whatsappTemplate)
    .where(and(eq(whatsappTemplate.id, id), eq(whatsappTemplate.organizationId, organizationId)));
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
  return row;
}

function rethrow(cause: unknown): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: cause instanceof Error ? cause.message : "WhatsApp request failed",
  });
}

export const whatsappTemplateRouter = router({
  list: orgProcedure.query(({ ctx }) =>
    db
      .select()
      .from(whatsappTemplate)
      .where(eq(whatsappTemplate.organizationId, ctx.org.id))
      .orderBy(desc(whatsappTemplate.createdAt)),
  ),

  /** Submits a template to Meta for review. */
  create: orgProcedure
    .input(z.object({ accountId: z.string().optional(), draft: templateDraftSchema }))
    .mutation(async ({ ctx, input }) => {
      assertOrgAdmin(ctx.org);
      const account = await findManagingAccount(ctx.org.id, input.accountId);
      try {
        return await createTemplate(account, input.draft);
      } catch (cause) {
        rethrow(cause);
      }
    }),

  /** Pulls every template on each connected WABA, including ones made in WhatsApp Manager. */
  sync: orgProcedure.mutation(async ({ ctx }) => {
    const accounts = await db
      .select()
      .from(whatsappAccount)
      .where(and(eq(whatsappAccount.organizationId, ctx.org.id), eq(whatsappAccount.status, "active")));
    const wabas = new Map(accounts.map((row) => [`${row.provider}:${row.wabaId}`, row]));
    let count = 0;
    try {
      for (const account of wabas.values()) count += (await syncTemplates(account)).length;
    } catch (cause) {
      rethrow(cause);
    }
    return { count };
  }),

  delete: orgProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    assertOrgAdmin(ctx.org);
    const row = await findOwnedTemplate(input.id, ctx.org.id);
    const [account] = await db
      .select()
      .from(whatsappAccount)
      .where(
        and(
          eq(whatsappAccount.organizationId, ctx.org.id),
          eq(whatsappAccount.provider, row.provider),
          eq(whatsappAccount.wabaId, row.wabaId),
          eq(whatsappAccount.status, "active"),
        ),
      );
    if (!account) {
      // No credentials left for that WABA; drop our copy only.
      await db.delete(whatsappTemplate).where(eq(whatsappTemplate.id, row.id));
      return { id: row.id };
    }
    try {
      await deleteTemplate(account, row);
    } catch (cause) {
      rethrow(cause);
    }
    return { id: row.id };
  }),
});
