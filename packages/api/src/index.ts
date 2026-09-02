import { resolveActiveOrganization } from "@retransmit/auth/organization";
import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

/**
 * Like `protectedProcedure`, but also resolves the organization the request
 * acts on (creating the user's personal organization on first use) and
 * exposes it as `ctx.org` with the caller's role in it.
 */
export const orgProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const org = await resolveActiveOrganization(
    ctx.session.user.id,
    ctx.session.session.activeOrganizationId,
  );
  return next({ ctx: { ...ctx, org } });
});

/** Throws unless the caller is an owner or admin of the active organization. */
export function assertOrgAdmin(org: { role: string }): void {
  if (org.role !== "owner" && org.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only organization owners and admins can do this",
    });
  }
}
