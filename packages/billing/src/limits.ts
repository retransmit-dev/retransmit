import { db } from "@retransmit/db";
import { invitation, member } from "@retransmit/db/schema/auth";
import { domain } from "@retransmit/db/schema/email";
import { and, count, eq } from "drizzle-orm";

import { getBillingAccount } from "./account";
import type { BillingAccount } from "./account";
import { isSelfHostedMode } from "./mode";
import { getPeriodUsage } from "./usage";

/**
 * Why a send is refused, in the shape the API and the dashboard both need. The
 * `code` is what the HTTP layer turns into an error code; `upgrade` says
 * whether a bigger plan would fix it, which is the difference between "add a
 * card" and "you are past your limit".
 */
export interface LimitFailure {
  code: "quota_exceeded" | "limit_exceeded" | "payment_method_required";
  message: string;
  limit: number;
  used: number;
  upgrade: boolean;
}

export type LimitCheck = { ok: true } | ({ ok: false } & LimitFailure);

const ok: LimitCheck = { ok: true };

/**
 * A failed check, as an error a transport can carry whole. tRPC puts it in the
 * `cause` of its `TRPCError` and the error formatter copies `failure` onto the
 * wire, so the dashboard can open the plan dialog on `upgrade` instead of
 * pattern-matching an error message.
 */
export class LimitError extends Error {
  readonly failure: LimitFailure;

  constructor(failure: LimitFailure) {
    super(failure.message);
    this.name = "LimitError";
    this.failure = failure;
  }
}

/**
 * Whether an organization may send `recipients` more emails.
 *
 * Every plan bills overage, but only against a card. An organization with a
 * payment method is never blocked — it goes over the allowance and Stripe rates
 * the extra on the plan's graduated price. One without a payment method stops
 * at the allowance, because there is nothing to charge the overage to.
 */
export async function checkEmailQuota(
  organizationId: string,
  recipients: number,
  options: { account?: BillingAccount } = {},
): Promise<LimitCheck> {
  if (isSelfHostedMode()) return ok;
  const account = options.account ?? (await getBillingAccount(organizationId));
  if (account.hasPaymentMethod) return ok;

  const usage = await getPeriodUsage(organizationId, { account });
  const limit = account.plan.includedEmails;
  if (usage.email + recipients <= limit) return ok;

  return {
    ok: false,
    code: "quota_exceeded",
    limit,
    used: usage.email,
    upgrade: true,
    message:
      `The ${account.plan.name} plan includes ${limit.toLocaleString("en-US")} emails per month ` +
      `and ${usage.email.toLocaleString("en-US")} have been sent. ` +
      "Add a payment method to keep sending at the overage rate, or upgrade the plan.",
  };
}

/**
 * Whether the organization has a card Stripe can charge. Self-hosted
 * deployments bill nothing, so they never need one.
 *
 * `upgrade` is false on every failure from here: a bigger plan does not put a
 * card on file, so the dashboard asks for one instead of showing the plans.
 */
async function requirePaymentMethod(
  organizationId: string,
  failure: { code: LimitFailure["code"]; message: string },
  options: { account?: BillingAccount } = {},
): Promise<LimitCheck> {
  if (isSelfHostedMode()) return ok;
  const account = options.account ?? (await getBillingAccount(organizationId));
  if (account.hasPaymentMethod) return ok;
  return { ok: false, ...failure, limit: 0, used: 0, upgrade: false };
}

/**
 * A card, for work that commits the organization to a bill it cannot pay for
 * yet: registering a sender id, submitting a WhatsApp template, a test send.
 * None of them costs anything by itself, but each one only exists to send
 * messages that are billed per message, and a carrier registration in
 * particular takes days to undo.
 *
 * `message` says which of those was refused, since "add a payment method" on
 * its own does not tell anyone what they were doing.
 *
 * The code is dashboard-only: the public API's pay-as-you-go refusal keeps
 * `quota_exceeded`, which is the code documented for it.
 */
export async function checkPaymentMethod(
  organizationId: string,
  message: string,
  options: { account?: BillingAccount } = {},
): Promise<LimitCheck> {
  return requirePaymentMethod(
    organizationId,
    { code: "payment_method_required", message },
    options,
  );
}

/**
 * SMS and WhatsApp are pay as you go on every plan, so they need a card rather
 * than an allowance.
 */
export async function checkPayAsYouGo(
  organizationId: string,
  channel: "SMS" | "WhatsApp",
  options: { account?: BillingAccount } = {},
): Promise<LimitCheck> {
  return requirePaymentMethod(
    organizationId,
    {
      code: "quota_exceeded",
      message: `${channel} is billed per message. Add a payment method in the dashboard to send.`,
    },
    options,
  );
}

/** Verified and pending domains an organization holds. */
export async function countDomains(organizationId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(domain)
    .where(eq(domain.organizationId, organizationId));
  return row?.value ?? 0;
}

export async function checkDomainLimit(organizationId: string): Promise<LimitCheck> {
  if (isSelfHostedMode()) return ok;
  const account = await getBillingAccount(organizationId);
  const used = await countDomains(organizationId);
  if (used < account.plan.domains) return ok;
  return {
    ok: false,
    code: "limit_exceeded",
    limit: account.plan.domains,
    used,
    upgrade: account.plan.id !== "business",
    message: `The ${account.plan.name} plan allows ${account.plan.domains} domain${
      account.plan.domains === 1 ? "" : "s"
    }. Upgrade to add more.`,
  };
}

/** Members plus pending invitations, since an invitation becomes a seat. */
export async function countSeats(organizationId: string): Promise<number> {
  const [members] = await db
    .select({ value: count() })
    .from(member)
    .where(eq(member.organizationId, organizationId));
  const [pending] = await db
    .select({ value: count() })
    .from(invitation)
    .where(
      and(eq(invitation.organizationId, organizationId), eq(invitation.status, "pending")),
    );
  return (members?.value ?? 0) + (pending?.value ?? 0);
}

export async function checkSeatLimit(organizationId: string): Promise<LimitCheck> {
  if (isSelfHostedMode()) return ok;
  const account = await getBillingAccount(organizationId);
  const used = await countSeats(organizationId);
  if (used < account.plan.teamMembers) return ok;
  return {
    ok: false,
    code: "limit_exceeded",
    limit: account.plan.teamMembers,
    used,
    upgrade: account.plan.id !== "business",
    message: `The ${account.plan.name} plan allows ${account.plan.teamMembers} team member${
      account.plan.teamMembers === 1 ? "" : "s"
    }, counting pending invitations. Upgrade to invite more.`,
  };
}

/** Oldest timestamp an organization can still see logs for. */
export async function logRetentionCutoff(organizationId: string): Promise<Date> {
  if (isSelfHostedMode()) return new Date(0);
  const account = await getBillingAccount(organizationId);
  return new Date(Date.now() - account.plan.logRetentionDays * 24 * 60 * 60 * 1000);
}
