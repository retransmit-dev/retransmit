import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth";

export const SUPPRESSION_REASONS = ["bounce", "complaint", "manual", "unsubscribe"] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

export const DOMAIN_STATUSES = ["pending", "verified", "failed", "temporary_failure"] as const;
export type DomainStatus = (typeof DOMAIN_STATUSES)[number];

export const EMAIL_STATUSES = [
  "queued",
  "scheduled",
  "sent",
  "delivery_delayed",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
  "suppressed",
  "canceled",
  "rejected",
  "failed",
] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

/**
 * A name/value label attached to an email at send time (for example
 * `{ name: "campaign", value: "outreach-1" }`). Tags never reach the
 * recipient; they exist so the dashboard and API can filter sends.
 */
export type EmailTag = { name: string; value: string };

export const WEBHOOK_EVENT_TYPES = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.opened",
  "email.clicked",
  "email.bounced",
  "email.complained",
  "email.rejected",
  "email.failed",
  "email.unsubscribed",
  "sms.sent",
  "sms.delivered",
  "sms.undelivered",
  "sms.failed",
  "whatsapp.sent",
  "whatsapp.delivered",
  "whatsapp.read",
  "whatsapp.failed",
  "whatsapp.received",
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const apiKey = pgTable(
  "api_key",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Owning organization. Nullable only for rows that predate organizations. */
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    /** SHA-256 hex digest of the full key. The full key is never stored. */
    keyHash: text("key_hash").notNull().unique(),
    /** Redacted display form, e.g. `rt_1a2b…9f0e`. */
    keyHint: text("key_hint").notNull(),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("apiKey_userId_idx").on(table.userId)],
);

export const domain = pgTable(
  "domain",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Owning organization. Nullable only for rows that predate organizations. */
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    status: text("status").$type<DomainStatus>().default("pending").notNull(),
    /** SES region the identity was created in. Sends from this domain go out of that region. */
    region: text("region").notNull(),
    /** DKIM tokens returned by SES when the identity is created. */
    dkimTokens: jsonb("dkim_tokens").$type<string[]>().default([]).notNull(),
    /**
     * Custom MAIL FROM (Return-Path) domain, e.g. `mail.example.com`. Null on
     * rows created before return paths were configurable; SES then uses its
     * own amazonses.com bounce domain.
     */
    mailFromDomain: text("mail_from_domain"),
    /** Verification of the MAIL FROM domain's MX and SPF records, as reported by SES. */
    mailFromStatus: text("mail_from_status").$type<DomainStatus>(),
    verifiedAt: timestamp("verified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("domain_name_uidx").on(table.name),
    index("domain_userId_idx").on(table.userId),
    index("domain_organizationId_idx").on(table.organizationId),
  ],
);

export const emailBatch = pgTable(
  "email_batch",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    apiKeyId: text("api_key_id").references(() => apiKey.id, { onDelete: "set null" }),
    /** Number of emails submitted with this batch. */
    total: integer("total").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("emailBatch_userId_createdAt_idx").on(table.userId, table.createdAt)],
);

export const email = pgTable(
  "email",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Owning organization. Nullable only for rows that predate organizations. */
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    apiKeyId: text("api_key_id").references(() => apiKey.id, { onDelete: "set null" }),
    domainId: text("domain_id").references(() => domain.id, { onDelete: "set null" }),
    batchId: text("batch_id").references(() => emailBatch.id, { onDelete: "set null" }),
    from: text("from").notNull(),
    to: jsonb("to").$type<string[]>().notNull(),
    cc: jsonb("cc").$type<string[]>(),
    bcc: jsonb("bcc").$type<string[]>(),
    replyTo: jsonb("reply_to").$type<string[]>(),
    subject: text("subject").notNull(),
    html: text("html"),
    text: text("text"),
    /**
     * Marketing sends get an unsubscribe link (`{{{unsubscribe_url}}}` in the
     * body) plus one-click List-Unsubscribe headers, and are blocked to
     * addresses that unsubscribed. Transactional sends ignore unsubscribes.
     */
    marketing: boolean("marketing").default(false).notNull(),
    /** Caller-supplied labels, filtered with jsonb containment. */
    tags: jsonb("tags").$type<EmailTag[]>(),
    /** Message id assigned by the upstream provider (SES). */
    providerMessageId: text("provider_message_id"),
    status: text("status").$type<EmailStatus>().default("queued").notNull(),
    error: text("error"),
    lastEventAt: timestamp("last_event_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("email_userId_createdAt_idx").on(table.userId, table.createdAt),
    index("email_providerMessageId_idx").on(table.providerMessageId),
    index("email_batchId_idx").on(table.batchId),
    index("email_userId_status_idx").on(table.userId, table.status),
    index("email_tags_gin_idx").using("gin", table.tags),
  ],
);

export const emailEvent = pgTable(
  "email_event",
  {
    id: text("id").primaryKey(),
    emailId: text("email_id")
      .notNull()
      .references(() => email.id, { onDelete: "cascade" }),
    type: text("type").$type<WebhookEventType>().notNull(),
    /** Raw provider payload (SES event) for debugging and display. */
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("emailEvent_emailId_idx").on(table.emailId)],
);

/**
 * Addresses an organization will not send to. Hard bounces and spam
 * complaints are added automatically by the SES callback; members can add or
 * import addresses manually. Shared by every member of the organization.
 */
export const suppression = pgTable(
  "suppression",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Bare address, lowercased. */
    email: text("email").notNull(),
    reason: text("reason").$type<SuppressionReason>().notNull(),
    /** Who added it, for manual/imported entries. */
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** The email whose bounce/complaint triggered an automatic entry. */
    sourceEmailId: text("source_email_id").references(() => email.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("suppression_organizationId_email_uidx").on(table.organizationId, table.email),
    index("suppression_organizationId_reason_idx").on(table.organizationId, table.reason),
    index("suppression_organizationId_createdAt_idx").on(table.organizationId, table.createdAt),
  ],
);

export const webhookEndpoint = pgTable(
  "webhook_endpoint",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    /** Shared secret used to sign deliveries (HMAC-SHA256). */
    secret: text("secret").notNull(),
    eventTypes: jsonb("event_types").$type<WebhookEventType[]>().notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("webhookEndpoint_userId_idx").on(table.userId)],
);

export const webhookDelivery = pgTable(
  "webhook_delivery",
  {
    id: text("id").primaryKey(),
    endpointId: text("endpoint_id")
      .notNull()
      .references(() => webhookEndpoint.id, { onDelete: "cascade" }),
    eventType: text("event_type").$type<WebhookEventType>().notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    responseStatus: integer("response_status"),
    success: boolean("success").default(false).notNull(),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("webhookDelivery_endpointId_idx").on(table.endpointId)],
);

export const apiKeyRelations = relations(apiKey, ({ one }) => ({
  user: one(user, { fields: [apiKey.userId], references: [user.id] }),
}));

export const domainRelations = relations(domain, ({ one, many }) => ({
  user: one(user, { fields: [domain.userId], references: [user.id] }),
  emails: many(email),
}));

export const emailRelations = relations(email, ({ one, many }) => ({
  user: one(user, { fields: [email.userId], references: [user.id] }),
  apiKey: one(apiKey, { fields: [email.apiKeyId], references: [apiKey.id] }),
  domain: one(domain, { fields: [email.domainId], references: [domain.id] }),
  batch: one(emailBatch, { fields: [email.batchId], references: [emailBatch.id] }),
  events: many(emailEvent),
}));

export const emailBatchRelations = relations(emailBatch, ({ one, many }) => ({
  user: one(user, { fields: [emailBatch.userId], references: [user.id] }),
  emails: many(email),
}));

export const emailEventRelations = relations(emailEvent, ({ one }) => ({
  email: one(email, { fields: [emailEvent.emailId], references: [email.id] }),
}));

export const suppressionRelations = relations(suppression, ({ one }) => ({
  organization: one(organization, {
    fields: [suppression.organizationId],
    references: [organization.id],
  }),
  createdBy: one(user, { fields: [suppression.createdByUserId], references: [user.id] }),
  sourceEmail: one(email, { fields: [suppression.sourceEmailId], references: [email.id] }),
}));

export const webhookEndpointRelations = relations(webhookEndpoint, ({ one, many }) => ({
  user: one(user, { fields: [webhookEndpoint.userId], references: [user.id] }),
  deliveries: many(webhookDelivery),
}));

export const webhookDeliveryRelations = relations(webhookDelivery, ({ one }) => ({
  endpoint: one(webhookEndpoint, {
    fields: [webhookDelivery.endpointId],
    references: [webhookEndpoint.id],
  }),
}));
