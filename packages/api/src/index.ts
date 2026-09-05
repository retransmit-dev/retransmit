import { isAdminEmail } from "@retransmit/auth/admin";
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

/**
 * Like `protectedProcedure`, but only for the product's operators. Reads the
 * allowlist in `@retransmit/auth/admin`; anyone else gets a 403.
 */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isAdminEmail(ctx.session.user.email)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
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
