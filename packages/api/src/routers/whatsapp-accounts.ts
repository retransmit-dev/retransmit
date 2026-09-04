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
import { sendTestMessage, testSendConfig } from "@retransmit/whatsapp/test-send";
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

  /** Env defaults for the test-send form (`/whatsapp/test`). */
  testConfig: orgProcedure.query(({ ctx }) => {
    assertOrgAdmin(ctx.org);
    return testSendConfig();
  }),

  /**
   * Sends one message straight to Meta's Cloud API with the sandbox
   * credentials, bypassing accounts and the queue. Returns the raw exchange
   * so the screen can show exactly what went over the wire; a Meta error is
   * part of that result rather than a thrown one.
   */
  sendTest: orgProcedure
    .input(
      z.object({
        phoneNumberId: z.string().trim().min(1),
        accessToken: z.string().optional(),
        to: z.string().trim().min(5),
        message: z.discriminatedUnion("type", [
          z.object({
            type: z.literal("text"),
            body: z.string().min(1).max(4096),
            previewUrl: z.boolean().optional(),
          }),
          z.object({
            type: z.literal("template"),
            name: z.string().trim().min(1),
            language: z.string().trim().min(2),
            bodyParameters: z.array(z.string()).max(20),
          }),
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertOrgAdmin(ctx.org);
      try {
        return await sendTestMessage(input);
      } catch (cause) {
        rethrow(cause);
      }
    }),
});
