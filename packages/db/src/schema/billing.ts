import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth";

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

/** Where a rate came from: the AWS-derived seed, or an operator's edit. */
export const RATE_SOURCES = ["seed", "manual"] as const;
export type RateSource = (typeof RATE_SOURCES)[number];

/**
 * What a customer pays to send one SMS segment to a country.
 *
 * A Stripe price cannot vary by destination, so the rate card lives here and
 * the meter carries the resulting money. Rates are per country because carrier
 * cost is: AWS list price spans $0.004 to $0.59 across the destinations we
 * offer, so one flat number is either uncompetitive or sold at a loss.
 *
 * A missing row is not an error — `@retransmit/billing` falls back to the
 * AWS-derived default in `@retransmit/sms/aws-prices`, so a destination is
 * priced even before the table is seeded. Seeding materializes those defaults
 * so an operator has something to edit.
 *
 * `costMicros` is what the route costs Retransmit, kept beside the price so the
 * admin editor can show the margin and flag anything selling below cost.
 */
export const smsRate = pgTable(
  "sms_rate",
  {
    /** ISO 3166-1 alpha-2 destination, as `detectCountry` returns it. */
    country: text("country").primaryKey(),
    /** Customer price per segment, in USD micros (1_000_000 = $1.00). */
    priceMicros: integer("price_micros").notNull(),
    /** Carrier cost per segment, USD micros. Display only; never billed. */
    costMicros: integer("cost_micros"),
    source: text("source").$type<RateSource>().default("seed").notNull(),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("smsRate_source_idx").on(table.source)],
);

/**
 * Categories WhatsApp bills by. Wider than `WHATSAPP_TEMPLATE_CATEGORIES`:
 * `service` is a free-form reply inside the 24-hour customer service window,
 * which has no template and is priced differently from the three template
 * categories.
 */
export const WHATSAPP_BILLING_CATEGORIES = [
  "marketing",
  "utility",
  "authentication",
  "service",
] as const;
export type WhatsappBillingCategory = (typeof WHATSAPP_BILLING_CATEGORIES)[number];

/**
 * What a customer pays for one WhatsApp message, by destination and category.
 *
 * Two dimensions rather than the one SMS needs: Meta's rates differ far more
 * between marketing and authentication than they do between countries. Unlike
 * `sms_rate` this table is not seeded, because Meta publishes its rate card
 * only through an interactive tool and inventing 984 country/category rows
 * would be worse than having none. Rows are added by an operator; anything
 * without one falls back to the per-category default in
 * `@retransmit/billing/rates`.
 */
export const whatsappRate = pgTable(
  "whatsapp_rate",
  {
    id: text("id").primaryKey(),
    /** ISO 3166-1 alpha-2 destination. */
    country: text("country").notNull(),
    category: text("category").$type<WhatsappBillingCategory>().notNull(),
    /** Customer price per message, in USD micros. */
    priceMicros: integer("price_micros").notNull(),
    /** Meta plus AWS pass-through cost per message, USD micros. Display only. */
    costMicros: integer("cost_micros"),
    source: text("source").$type<RateSource>().default("manual").notNull(),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("whatsappRate_country_category_uidx").on(table.country, table.category),
  ],
);
