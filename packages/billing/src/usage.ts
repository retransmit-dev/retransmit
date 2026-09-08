import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { billingUsage } from "@retransmit/db/schema/billing";
import type { UsageMetric } from "@retransmit/db/schema/billing";
import { and, eq, gt, sql } from "drizzle-orm";

import { getBillingAccount, usagePeriodStart } from "./account";
import type { BillingAccount } from "./account";
import { getStripe } from "./stripe";

/** Meter event names created by `infra/setup-stripe.sh`. */
const METER_EVENTS: Record<UsageMetric, string> = {
  email: "retransmit_emails",
  sms: "retransmit_sms",
  whatsapp: "retransmit_whatsapp",
};

/**
 * Adds usage to the current period and pushes it to Stripe's meter.
 *
 * The local counter is authoritative for quota checks and is written first, so
 * a Stripe outage can never let an organization send past its allowance. The
 * meter event is best effort: `reportedQuantity` only moves once Stripe has
 * accepted the units, so whatever is still missing is the difference, and
 * `reportUnbilledUsage` pushes it later. Meter aggregation is a sum, which
 * makes a replayed delta additive rather than idempotent — hence the two
 * counters instead of a retry loop.
 */
export async function recordUsage(
  organizationId: string,
  metric: UsageMetric,
  quantity: number,
  options: { account?: BillingAccount; when?: Date } = {},
): Promise<void> {
  if (quantity <= 0) return;

  const account = options.account ?? (await getBillingAccount(organizationId));
  const periodStart = usagePeriodStart(account, options.when);

  await db
    .insert(billingUsage)
    .values({ id: createId("usg"), organizationId, metric, periodStart, quantity })
    .onConflictDoUpdate({
      target: [billingUsage.organizationId, billingUsage.metric, billingUsage.periodStart],
      set: { quantity: sql`${billingUsage.quantity} + ${quantity}`, updatedAt: new Date() },
    });

  // Free organizations that never subscribed have no customer to meter
  // against; their usage is only ever checked against the allowance.
  if (!account.stripeCustomerId) return;

  const sent = await sendMeterEvent(account.stripeCustomerId, metric, quantity);
  if (!sent) return;

  await db
    .update(billingUsage)
    .set({ reportedQuantity: sql`${billingUsage.reportedQuantity} + ${quantity}` })
    .where(
      and(
        eq(billingUsage.organizationId, organizationId),
        eq(billingUsage.metric, metric),
        eq(billingUsage.periodStart, periodStart),
      ),
    );
}

async function sendMeterEvent(
  stripeCustomerId: string,
  metric: UsageMetric,
  value: number,
): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe) return false;
  try {
    await stripe.v2.billing.meterEvents.create({
      event_name: METER_EVENTS[metric],
      payload: { stripe_customer_id: stripeCustomerId, value: String(value) },
    });
    return true;
  } catch (error) {
    // Never fail a send because metering did. The gap is recoverable from
    // `billing_usage`, and dropping the message would not be.
    console.error(`Failed to report ${metric} usage to Stripe`, error);
    return false;
  }
}

/**
 * Pushes usage that a failed meter event left behind. Meant for a periodic job;
 * running it twice is safe because each row only ever sends its own outstanding
 * difference.
 */
export async function reportUnbilledUsage(limit = 200): Promise<number> {
  const stripe = getStripe();
  if (!stripe) return 0;

  const rows = await db
    .select({
      id: billingUsage.id,
      organizationId: billingUsage.organizationId,
      metric: billingUsage.metric,
      outstanding: sql<number>`${billingUsage.quantity} - ${billingUsage.reportedQuantity}`,
    })
    .from(billingUsage)
    .where(gt(billingUsage.quantity, billingUsage.reportedQuantity))
    .limit(limit);

  let reported = 0;
  for (const row of rows) {
    const account = await getBillingAccount(row.organizationId);
    if (!account.stripeCustomerId) continue;
    const outstanding = Number(row.outstanding);
    if (outstanding <= 0) continue;
    if (!(await sendMeterEvent(account.stripeCustomerId, row.metric, outstanding))) continue;
    await db
      .update(billingUsage)
      .set({ reportedQuantity: sql`${billingUsage.reportedQuantity} + ${outstanding}` })
      .where(eq(billingUsage.id, row.id));
    reported += 1;
  }
  return reported;
}

export interface PeriodUsage {
  email: number;
  sms: number;
  whatsapp: number;
}

/** Usage so far in the organization's current billing period. */
export async function getPeriodUsage(
  organizationId: string,
  options: { account?: BillingAccount } = {},
): Promise<PeriodUsage> {
  const account = options.account ?? (await getBillingAccount(organizationId));
  const rows = await db
    .select({ metric: billingUsage.metric, quantity: billingUsage.quantity })
    .from(billingUsage)
    .where(
      and(
        eq(billingUsage.organizationId, organizationId),
        eq(billingUsage.periodStart, usagePeriodStart(account)),
      ),
    );

  const usage: PeriodUsage = { email: 0, sms: 0, whatsapp: 0 };
  for (const row of rows) usage[row.metric] = Number(row.quantity);
  return usage;
}
