import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization } from "./auth";

export const PLAN_IDS = ["free", "pro", "business"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/**
 * Mirrors Stripe's subscription statuses, plus `none` for an organization that
 * has never subscribed. Free organizations sit at `none` until someone adds a
 * card, so an absent subscription and a canceled one stay distinguishable.
 */
export const BILLING_STATUSES = [
  "none",
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "paused",
] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

/** What a usage row counts. See `billingUsage.quantity` for the units. */
export const USAGE_METRICS = ["email", "sms", "whatsapp"] as const;
export type UsageMetric = (typeof USAGE_METRICS)[number];

/**
 * One row per organization, holding the plan and the Stripe objects behind it.
 * Stripe is the source of truth for what is charged; this table is the cached
 * answer to "what is this organization allowed to do right now", which every
 * send has to ask and which cannot wait on an API call.
 */
export const billingAccount = pgTable(
  "billing_account",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organization.id, { onDelete: "cascade" }),
    plan: text("plan").$type<PlanId>().default("free").notNull(),
    status: text("status").$type<BillingStatus>().default("none").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    /**
     * Whether the subscription carries a usable payment method. Free
     * organizations without one are capped at the included allowance instead of
     * running up an overage nobody can collect.
     */
    hasPaymentMethod: boolean("has_payment_method").default(false).notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    /** Start of the current Stripe billing period; the period usage is counted in. */
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("billingAccount_stripeCustomerId_uidx").on(table.stripeCustomerId),
    uniqueIndex("billingAccount_stripeSubscriptionId_uidx").on(table.stripeSubscriptionId),
  ],
);

/**
 * Usage for one organization, metric and billing period.
 *
 * This is the local counter the send path checks against the plan allowance,
 * kept separately from the `email` and `sms` tables because those are purged on
 * the plan's log retention (one day on Free) while the period's usage has to
 * survive to the invoice.
 *
 * `quantity` is recipients for `email`, and USD 0.0001 units for `sms` and
 * `whatsapp` — those two are priced per destination country, which a Stripe
 * price cannot express, so the meter carries money rather than messages.
 * `reportedQuantity` is how much of it Stripe's meter has already accepted;
 * the difference is what a retry still owes.
 */
export const billingUsage = pgTable(
  "billing_usage",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    metric: text("metric").$type<UsageMetric>().notNull(),
    periodStart: timestamp("period_start").notNull(),
    quantity: bigint("quantity", { mode: "number" }).default(0).notNull(),
    reportedQuantity: bigint("reported_quantity", { mode: "number" }).default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("billingUsage_org_metric_period_uidx").on(
      table.organizationId,
      table.metric,
      table.periodStart,
    ),
    index("billingUsage_unreported_idx").on(table.organizationId, table.metric),
  ],
);

export const billingAccountRelations = relations(billingAccount, ({ one }) => ({
  organization: one(organization, {
    fields: [billingAccount.organizationId],
    references: [organization.id],
  }),
}));

export const billingUsageRelations = relations(billingUsage, ({ one }) => ({
  organization: one(organization, {
    fields: [billingUsage.organizationId],
    references: [organization.id],
  }),
}));
