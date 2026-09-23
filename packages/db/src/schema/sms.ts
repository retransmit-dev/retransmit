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

/** Transactional purposes an approved SMS program may send. */
export const SMS_PURPOSES = ["otp", "security", "account", "reminder", "status_update"] as const;
export type SmsPurpose = (typeof SMS_PURPOSES)[number];

/** How a recipient gave the sender permission to text this number. */
export const SMS_CONSENT_METHODS = [
  "web_form",
  "otp_request",
  "keyword",
  "written",
  "verbal",
] as const;
export type SmsConsentMethod = (typeof SMS_CONSENT_METHODS)[number];

export const SMS_SUPPRESSION_REASONS = ["opt_out", "manual", "complaint", "provider"] as const;
export type SmsSuppressionReason = (typeof SMS_SUPPRESSION_REASONS)[number];

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
    /**
     * AWS region the sender id is registered in. An origination identity is a
     * regional resource: the same name registered in `af-south-1` does not
     * exist in `eu-central-1`, so a send that used the wrong region would be
     * rejected upstream. Sends carrying this sender id go out of this region.
     * See SMS_REGIONS in @retransmit/sms/regions.
     */
    region: text("region").notNull(),
    status: text("status").$type<SmsSenderStatus>().default("pending").notNull(),
    /**
     * Registration paperwork, and null when the destinations do not need any.
     * Only `registration` countries (see SMS_COUNTRIES) are filed with a
     * carrier; everywhere else the sender id is accepted as-is, so asking for
     * a use case, a sample and a legal entity would collect what no filing
     * consumes. The request itself still exists in those countries: it is the
     * allowlist behind `from`.
     */
    useCase: text("use_case"),
    /** A representative message body, as the filing asks for it. */
    sampleMessage: text("sample_message"),
    /** Legal entity behind the sender id, and its site. Both go on the filing. */
    companyName: text("company_name"),
    companyWebsite: text("company_website"),
    /** Public evidence reviewed before this program may send. */
    optInUrl: text("opt_in_url"),
    privacyUrl: text("privacy_url"),
    termsUrl: text("terms_url"),
    supportEmail: text("support_email"),
    /** Appended to every outbound message because alphanumeric sender ids cannot receive STOP. */
    optOutText: text("opt_out_text"),
    /** Only these declared transactional purposes may be used on the send API. */
    purposes: jsonb("purposes").$type<SmsPurpose[]>().default([]).notNull(),
    /** Applicant forecast; retained as part of the compliance review. */
    expectedDailyVolume: integer("expected_daily_volume"),
    expectedMonthlyVolume: integer("expected_monthly_volume"),
    /** Operator-approved caps. Null means the program is not ready to send. */
    dailyLimit: integer("daily_limit"),
    monthlyLimit: integer("monthly_limit"),
    recipientDailyLimit: integer("recipient_daily_limit"),
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
    /** Approved program/sender whose consent and limits authorize this send. */
    smsSenderId: text("sms_sender_id").references(() => smsSender.id, { onDelete: "restrict" }),
    /** Sender id shown on the recipient's device (alphanumeric or short code). */
    from: text("from"),
    /** Recipient MSISDNs, normalized E.164 (`+2376...`). */
    to: jsonb("to").$type<string[]>().notNull(),
    text: text("text").notNull(),
    /** Transactional purpose checked against both the program and recipient consent. */
    purpose: text("purpose").$type<SmsPurpose>(),
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
    /**
     * AWS region the message went out of, for routes that have one. Set at
     * enqueue time from the resolved sender id (or an explicit test override)
     * and confirmed by the provider on send. Null on the direct carrier
     * routes, which are not regional, and on rows that predate this column.
     */
    region: text("region"),
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
    index("sms_organizationId_senderId_createdAt_idx").on(
      table.organizationId,
      table.smsSenderId,
      table.createdAt,
    ),
  ],
);

/**
 * Auditable, recipient-specific permission to send one or more message types.
 * One row is the latest state for a number and approved program; re-consent
 * updates it and clears optedOutAt rather than erasing the earlier source.
 */
export const smsConsent = pgTable(
  "sms_consent",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    smsSenderId: text("sms_sender_id")
      .notNull()
      .references(() => smsSender.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    purposes: jsonb("purposes").$type<SmsPurpose[]>().default([]).notNull(),
    method: text("method").$type<SmsConsentMethod>().notNull(),
    /** Page, screen, form id, or human-readable source of the consent. */
    source: text("source").notNull(),
    /** Exact disclosure shown to the recipient, for a carrier audit. */
    disclosureText: text("disclosure_text").notNull(),
    evidenceUrl: text("evidence_url"),
    consentedAt: timestamp("consented_at").notNull(),
    confirmedAt: timestamp("confirmed_at"),
    optedOutAt: timestamp("opted_out_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("smsConsent_org_sender_phone_uidx").on(
      table.organizationId,
      table.smsSenderId,
      table.phone,
    ),
    index("smsConsent_organizationId_createdAt_idx").on(table.organizationId, table.createdAt),
  ],
);

/** Organization-wide block checked again immediately before provider send. */
export const smsSuppression = pgTable(
  "sms_suppression",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    reason: text("reason").$type<SmsSuppressionReason>().notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("smsSuppression_org_phone_uidx").on(table.organizationId, table.phone),
    index("smsSuppression_organizationId_createdAt_idx").on(table.organizationId, table.createdAt),
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
  sender: one(smsSender, { fields: [sms.smsSenderId], references: [smsSender.id] }),
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

export const smsConsentRelations = relations(smsConsent, ({ one }) => ({
  organization: one(organization, {
    fields: [smsConsent.organizationId],
    references: [organization.id],
  }),
  sender: one(smsSender, { fields: [smsConsent.smsSenderId], references: [smsSender.id] }),
}));

export const smsSuppressionRelations = relations(smsSuppression, ({ one }) => ({
  organization: one(organization, {
    fields: [smsSuppression.organizationId],
    references: [organization.id],
  }),
}));
