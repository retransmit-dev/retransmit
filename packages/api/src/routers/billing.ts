import {
  PLAN_LIST,
  changePlan,
  countDomains,
  countSeats,
  createCheckoutSession,
  createPortalSession,
  getBillingAccount,
  getPeriodUsage,
  isBillingConfigured,
  isCloudMode,
  unitsToCents,
  usagePeriodEnd,
  usagePeriodStart,
} from "@retransmit/billing";
import { PLAN_IDS } from "@retransmit/db/schema/billing";
import { TRPCError } from "@trpc/server";
import z from "zod";

import { assertOrgAdmin, orgProcedure, router } from "../index";

/**
 * Where Stripe sends people back to. The dashboard and better-auth share a
 * base URL, which is also what invitation links are built from.
 */
function dashboardUrl(path: string): string {
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3001";
  return new URL(path, base).toString();
}

function requireConfigured(): void {
  if (!isBillingConfigured()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Billing is not configured on this deployment",
    });
  }
}

const cloudOrgProcedure = orgProcedure.use(({ next }) => {
  if (!isCloudMode()) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Billing is not available in self-hosted mode",
    });
  }
  return next();
});

const planInput = z.object({ plan: z.enum(PLAN_IDS) });

export const billingRouter = router({
  /** The plan table, for the dashboard's plan picker. */
  plans: cloudOrgProcedure.query(() =>
    PLAN_LIST.map((plan) => ({
      id: plan.id,
      name: plan.name,
      priceCents: plan.priceCents,
      includedEmails: plan.includedEmails,
      overageCentsPer1K: plan.overageCentsPer1K,
      domains: plan.domains,
      teamMembers: plan.teamMembers,
      logRetentionDays: plan.logRetentionDays,
      support: plan.support,
    })),
  ),

  /**
   * Everything the billing page shows: the current plan, how much of each limit
   * is used, and what the metered channels have cost so far this period.
   */
  overview: cloudOrgProcedure.query(async ({ ctx }) => {
    const account = await getBillingAccount(ctx.org.id);
    const [usage, domains, seats] = await Promise.all([
      getPeriodUsage(ctx.org.id, { account }),
      countDomains(ctx.org.id),
      countSeats(ctx.org.id),
    ]);

    return {
      configured: isBillingConfigured(),
      plan: account.plan.id,
      planName: account.plan.name,
      status: account.status,
      hasPaymentMethod: account.hasPaymentMethod,
      cancelAtPeriodEnd: account.cancelAtPeriodEnd,
      periodStart: usagePeriodStart(account),
      periodEnd: usagePeriodEnd(account),
      usage: {
        emails: usage.email,
        includedEmails: account.plan.includedEmails,
        // Overage is only charged past the allowance, so show it that way.
        overageEmails: Math.max(0, usage.email - account.plan.includedEmails),
        overageCentsPer1K: account.plan.overageCentsPer1K,
        smsCents: unitsToCents(usage.sms),
        whatsappCents: unitsToCents(usage.whatsapp),
      },
      limits: {
        domains: { used: domains, limit: account.plan.domains },
        teamMembers: { used: seats, limit: account.plan.teamMembers },
        logRetentionDays: account.plan.logRetentionDays,
        support: account.plan.support,
      },
    };
  }),

  /**
   * Starts Checkout for an organization with no subscription yet. Free goes
   * through it too: the $0 price collects nothing but puts a card on file, which
   * is what email overage, SMS and WhatsApp need.
   */
  checkout: cloudOrgProcedure.input(planInput).mutation(async ({ ctx, input }) => {
    assertOrgAdmin(ctx.org);
    requireConfigured();
    const url = await createCheckoutSession({
      organizationId: ctx.org.id,
      plan: input.plan,
      successUrl: dashboardUrl("/settings/billing?checkout=success"),
      cancelUrl: dashboardUrl("/settings/billing?checkout=canceled"),
    });
    return { url };
  }),

  /** Moves an existing subscription between plans, prorating the difference. */
  changePlan: cloudOrgProcedure.input(planInput).mutation(async ({ ctx, input }) => {
    assertOrgAdmin(ctx.org);
    requireConfigured();
    const account = await getBillingAccount(ctx.org.id);
    if (!account.stripeSubscriptionId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Subscribe first so there is a payment method to charge",
      });
    }
    await changePlan(ctx.org.id, input.plan);
    // The webhook writes the new plan; returning it early would show a state
    // Stripe has not confirmed.
    return { ok: true };
  }),

  /** Customer portal, for cards, invoices, tax ids and cancellation. */
  portal: cloudOrgProcedure.mutation(async ({ ctx }) => {
    assertOrgAdmin(ctx.org);
    requireConfigured();
    const url = await createPortalSession(ctx.org.id, dashboardUrl("/settings/billing"));
    return { url };
  }),
});
