import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { organization, user } from "./auth";
import { apiKey } from "./email";
import type { WebhookEventType } from "./email";

export const SMS_STATUSES = [
  "queued",
  "sent",
  "delivered",
  "undelivered",
  "expired",
  "rejected",
  "failed",
] as const;
export type SmsStatus = (typeof SMS_STATUSES)[number];

/**
 * Provider names a send may pin itself to. Carrier-level on purpose: `mtn`
 * covers every MTN opco, so adding an opco never changes what callers send.
 * Lives here rather than in @retransmit/sms because it is persisted, and
 * because @retransmit/sms already depends on this package.
 */
export const SMS_PROVIDER_NAMES = ["mtn", "orange", "sns"] as const;
export type SmsProviderName = (typeof SMS_PROVIDER_NAMES)[number];

/**
 * Lifecycle of a sender id request. `pending` is the whole point of the
 * table: in most countries the string that shows on the handset has to be
 * registered with the carriers first, which takes days, so the request is a
 * durable object with a status rather than a form that either works or does
 * not.
 */
export const SMS_SENDER_STATUSES = ["pending", "approved", "rejected"] as const;
export type SmsSenderStatus = (typeof SMS_SENDER_STATUSES)[number];

/**
 * A sender id an organization is allowed to send from, per country.
 *
 * Retransmit owns the carrier relationships and the AWS account, so a
 * customer never brings credentials or a number: they ask for a name, an
 * operator registers it upstream (AWS End User Messaging for the SNS route,
 * the MTN/Orange account for the direct carrier routes) and flips the row to
 * `approved`. Until then nothing may send with it.
 *
 * This is also the allowlist behind the `from` field on `POST /v1/sms`:
 * without it any customer could put any brand on a handset.
 */
export const smsSender = pgTable(
  "sms_sender",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Member who filed the request; the audit trail for the registration. */
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The string shown on the handset. Alphanumeric, at most 11 characters. */
    senderId: text("sender_id").notNull(),
    /** ISO 3166-1 alpha-2 destinations this sender id is requested for. */
    countries: jsonb("countries").$type<string[]>().default([]).notNull(),
    status: text("status").$type<SmsSenderStatus>().default("pending").notNull(),
    /** What the customer sends: carriers ask for this on every registration. */
    useCase: text("use_case").notNull(),
    /** A representative message body, also required by most registrations. */
    sampleMessage: text("sample_message").notNull(),
    /** Legal entity behind the sender id, and its site. Both go on the filing. */
    companyName: text("company_name").notNull(),
    companyWebsite: text("company_website"),
    /**
     * Upstream reference once filed: an AWS End User Messaging registration
     * id, or a carrier ticket. Null while the request is still on our side.
     */
    registrationId: text("registration_id"),
    /** Operator note; the rejection reason the customer reads. */
    reviewNote: text("review_note"),
    reviewedAt: timestamp("reviewed_at"),
    /** Operator who approved or rejected. Not a user reference: may be gone. */
    reviewedBy: text("reviewed_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // One row per name per organization: re-requesting a name that is already
    // pending or approved is a no-op, not a second registration.
    uniqueIndex("smsSender_org_senderId_uidx").on(table.organizationId, table.senderId),
    index("smsSender_organizationId_idx").on(table.organizationId),
    index("smsSender_status_idx").on(table.status),
  ],
);

export const sms = pgTable(
  "sms",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    apiKeyId: text("api_key_id").references(() => apiKey.id, { onDelete: "set null" }),
    /** Sender id shown on the recipient's device (alphanumeric or short code). */
    from: text("from"),
    /** Recipient MSISDNs, normalized E.164 (`+2376...`). */
    to: jsonb("to").$type<string[]>().notNull(),
    text: text("text").notNull(),
    /** ISO 3166-1 alpha-2 destination country detected from the first recipient. */
    country: text("country"),
    /** Billable message parts (GSM-7: 160/153 chars, UCS-2: 70/67). */
    segments: integer("segments").default(1).notNull(),
    /**
     * Provider the caller pinned the send to, null to let routing choose.
     * Kept because routing runs in the worker, not at enqueue time.
     */
    requestedProvider: text("requested_provider").$type<SmsProviderName>(),
    /** Routing key of the provider that carried the message, e.g. `mtn_cm`. */
    provider: text("provider"),
    /** Message/transaction id assigned by the upstream provider. */
    providerMessageId: text("provider_message_id"),
    status: text("status").$type<SmsStatus>().default("queued").notNull(),
    error: text("error"),
    lastEventAt: timestamp("last_event_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("sms_userId_createdAt_idx").on(table.userId, table.createdAt),
    index("sms_providerMessageId_idx").on(table.providerMessageId),
    index("sms_userId_status_idx").on(table.userId, table.status),
  ],
);

export const smsEvent = pgTable(
  "sms_event",
  {
    id: text("id").primaryKey(),
    smsId: text("sms_id")
      .notNull()
      .references(() => sms.id, { onDelete: "cascade" }),
    type: text("type").$type<WebhookEventType>().notNull(),
    /** Raw provider payload (delivery receipt) for debugging and display. */
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("smsEvent_smsId_idx").on(table.smsId)],
);

export const smsRelations = relations(sms, ({ one, many }) => ({
  user: one(user, { fields: [sms.userId], references: [user.id] }),
  apiKey: one(apiKey, { fields: [sms.apiKeyId], references: [apiKey.id] }),
  events: many(smsEvent),
}));

export const smsEventRelations = relations(smsEvent, ({ one }) => ({
  sms: one(sms, { fields: [smsEvent.smsId], references: [sms.id] }),
}));

export const smsSenderRelations = relations(smsSender, ({ one }) => ({
  organization: one(organization, {
    fields: [smsSender.organizationId],
    references: [organization.id],
  }),
  user: one(user, { fields: [smsSender.userId], references: [user.id] }),
}));
