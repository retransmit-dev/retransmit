import { db } from "@retransmit/db";
import { whatsappAccount } from "@retransmit/db/schema/whatsapp";
import {
  WhatsappAccountError,
  connectAccount,
  disconnectAccount,
  publicAccount,
  syncAccount,
} from "@retransmit/whatsapp/accounts";
import { embeddedSignupConfig } from "@retransmit/whatsapp/meta-signup";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import z from "zod";

import { assertOrgAdmin, orgProcedure, router } from "../index";

async function findOwnedAccount(id: string, organizationId: string) {
  const [row] = await db
    .select()
    .from(whatsappAccount)
    .where(and(eq(whatsappAccount.id, id), eq(whatsappAccount.organizationId, organizationId)));
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "WhatsApp number not found" });
  return row;
}

function rethrow(cause: unknown): never {
  if (cause instanceof WhatsappAccountError) {
    throw new TRPCError({
      code: cause.code === "conflict" ? "CONFLICT" : "BAD_REQUEST",
      message: cause.message,
    });
  }
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: cause instanceof Error ? cause.message : "WhatsApp request failed",
  });
}

export const whatsappAccountRouter = router({
  /**
   * What the dashboard needs to open Meta's Embedded Signup dialog. `null`
   * when this deployment has no Meta app configured.
   */
  signupConfig: orgProcedure.query(() => embeddedSignupConfig()),

  list: orgProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select()
      .from(whatsappAccount)
      .where(eq(whatsappAccount.organizationId, ctx.org.id))
      .orderBy(desc(whatsappAccount.createdAt));
    return rows.map(publicAccount);
  }),

  /** Completes Embedded Signup with what Meta's dialog handed back. */
  connect: orgProcedure
    .input(
      z.object({
        code: z.string().min(1),
        wabaId: z.string().min(1),
        phoneNumberId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertOrgAdmin(ctx.org);
      if (!embeddedSignupConfig()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "WhatsApp is not configured on this deployment",
        });
      }
      try {
        const row = await connectAccount({
          organizationId: ctx.org.id,
          userId: ctx.session.user.id,
          ...input,
        });
        return publicAccount(row);
      } catch (cause) {
        rethrow(cause);
      }
    }),

  /** Refreshes name, quality rating and registration from Meta. */
  sync: orgProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const row = await findOwnedAccount(input.id, ctx.org.id);
    try {
      return publicAccount(await syncAccount(row));
    } catch (cause) {
      rethrow(cause);
    }
  }),

  disconnect: orgProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertOrgAdmin(ctx.org);
      const row = await findOwnedAccount(input.id, ctx.org.id);
      await disconnectAccount(row);
      return { id: row.id };
    }),
});
