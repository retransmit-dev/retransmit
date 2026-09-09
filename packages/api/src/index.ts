import { isAdminEmail } from "@retransmit/auth/admin";
import { resolveActiveOrganization } from "@retransmit/auth/organization";
import { LimitError } from "@retransmit/billing/limits";
import type { LimitCheck } from "@retransmit/billing/limits";
import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create({
  /**
   * Plan limits travel as data, not prose: the dashboard opens its plan dialog
   * on `limit.upgrade` rather than matching on the message. Everything else
   * keeps the default shape and stays a toast.
   */
  errorFormatter({ shape, error }) {
    const limit = error.cause instanceof LimitError ? error.cause.failure : null;
    return { ...shape, data: { ...shape.data, limit } };
  },
});

/**
 * Refuses a request that a plan limit does not cover. `FORBIDDEN` because the
 * request is well formed and the caller is who they say they are; what is
 * missing is entitlement. The failure rides along in the cause so the error
 * formatter can put it on the wire.
 */
export function assertWithinLimit(check: LimitCheck): void {
  if (check.ok) return;
  const { ok, ...failure } = check;
  throw new TRPCError({
    code: "FORBIDDEN",
    message: failure.message,
    cause: new LimitError(failure),
  });
}

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
