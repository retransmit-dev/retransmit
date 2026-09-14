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
 * Why a bounce happened, derived from the SMTP diagnostic code the receiving
 * server returned (see `@retransmit/email/bounce`). The distinction that
 * matters is whether the *address* is bad or whether *we* were blocked: only
 * the former belongs on the suppression list. A spam filter rejecting a
 * message says nothing about whether the mailbox exists.
 */
export const BOUNCE_REASONS = [
  /** No such mailbox at this domain. The address is dead. */
  "mailbox_not_found",
  /** The mailbox exists but is over quota. Usually temporary. */
  "mailbox_full",
  /** The account is disabled, suspended or no longer in use. */
  "mailbox_inactive",
  /** A spam filter rejected the message on its content. */
  "spam_block",
  /** The sending IP or domain is blocked or on a blocklist. */
  "reputation_block",
  /** SPF, DKIM or DMARC did not pass at the receiver. */
  "authentication_failure",
  /** The receiver is throttling us and would accept this later. */
  "rate_limited",
  /** The message exceeded the receiver's size limit. */
  "message_too_large",
  /** An attachment or the body was refused (virus scan, banned file type). */
  "content_rejected",
  /** A recipient-side rule refused the message (no external mail, allowlist). */
  "policy_block",
  /** The recipient domain does not resolve or has no mail server. */
  "dns_failure",
  /** SES refused to send because the address is on its own suppression list. */
  "provider_suppressed",
  /** Nothing in the diagnostic code was recognisable. */
  "unknown",
] as const;
export type BounceReason = (typeof BOUNCE_REASONS)[number];

/**
 * Who runs the recipient's mailbox, resolved from the MX records of their
 * domain (see `@retransmit/email/mailbox-provider`). A custom domain says
 * nothing about the provider behind it, and providers differ enormously in
 * how they filter, so this is what makes deliverability numbers comparable.
 *
 * `microsoft365` and `google_workspace` are custom domains hosted by those
 * providers; `outlook_consumer` and `gmail` are their free consumer domains.
 * The gateway entries (Mimecast, Proofpoint, Barracuda) usually sit in front
 * of another provider, but their filtering is what decides delivery.
 */
export const MAILBOX_PROVIDERS = [
  "microsoft365",
  "outlook_consumer",
  "google_workspace",
  "gmail",
  "yahoo",
  "apple",
  "proton",
  "zoho",
  "fastmail",
  "mimecast",
  "proofpoint",
  "barracuda",
  "ovh",
  "ionos",
  /** MX records exist but match nothing we know, e.g. self-hosted or cPanel. */
  "other",
  /** The domain publishes no usable MX record, so it cannot receive mail. */
  "none",
] as const;
export type MailboxProvider = (typeof MAILBOX_PROVIDERS)[number];

/**
 * A name/value label attached to an email at send time (for example
 * `{ name: "campaign", value: "outreach-1" }`). Tags never reach the
 * recipient; they exist so the dashboard and API can filter sends.
 */
export type EmailTag = { name: string; value: string };

/**
 * Caller-supplied message headers, keyed by header name as given (for
 * example `{ "X-Entity-Ref-ID": "order_123" }`). Added to the message as-is;
 * envelope headers such as From or Subject are rejected at the API.
 */
export type EmailHeaders = Record<string, string>;

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
    /** Custom message headers sent with the email, e.g. X-Entity-Ref-ID. */
    headers: jsonb("headers").$type<EmailHeaders>(),
    /**
     * When a scheduled send should go out. Null for an immediate send. The
     * queue job is delayed until this time, and the worker refuses to send
     * before it, so a reschedule only has to move this column and enqueue a
     * fresh job: an older job that fires early finds the row not yet due and
     * does nothing.
     */
    scheduledAt: timestamp("scheduled_at"),
    /** Message id assigned by the upstream provider (SES). */
    providerMessageId: text("provider_message_id"),
    status: text("status").$type<EmailStatus>().default("queued").notNull(),
    error: text("error"),
    /**
     * Set when status is `bounced`: why the receiving server refused the
     * message, classified from its SMTP diagnostic code. `error` carries the
     * matching sentence and the raw code.
     */
    bounceReason: text("bounce_reason").$type<BounceReason>(),
    /**
     * Who runs the first recipient's mailbox, from the MX records of their
     * domain. Resolved after the send and best-effort, so it stays null when
     * the lookup failed or the row predates the lookup.
     */
    recipientProvider: text("recipient_provider").$type<MailboxProvider>(),
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
    index("email_userId_recipientProvider_idx").on(table.userId, table.recipientProvider),
    index("email_scheduledAt_idx").on(table.scheduledAt),
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
 * A file attached to an email. The bytes live in the S3 bucket of the region
 * the sending domain was verified in (`${ATTACHMENTS_BUCKET_PREFIX}-${region}`)
 * and are deleted 30 days after upload by the bucket's lifecycle rule. This
 * row outlives the object so the dashboard and API can still list what was
 * sent; `expiresAt` mirrors the lifecycle so a download link is only offered
 * while the object exists.
 */
export const emailAttachment = pgTable(
  "email_attachment",
  {
    id: text("id").primaryKey(),
    emailId: text("email_id")
      .notNull()
      .references(() => email.id, { onDelete: "cascade" }),
    /** Name the recipient sees, as given by the caller. */
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    /** Size in bytes of the raw (not base64) content. */
    size: integer("size").notNull(),
    /** Content-ID for inline images referenced as `cid:` in the HTML body. */
    contentId: text("content_id"),
    /** Inline disposition (embedded image) rather than a regular attachment. */
    inline: boolean("inline").default(false).notNull(),
    /** S3 region and object key the bytes were uploaded to. */
    storageRegion: text("storage_region").notNull(),
    storageKey: text("storage_key").notNull(),
    /** Remote URL the file was fetched from, when given as `path`. */
    sourceUrl: text("source_url"),
    /** When the S3 object is deleted by the lifecycle rule. */
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("emailAttachment_emailId_idx").on(table.emailId)],
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

/**
 * MX lookup cache, keyed by recipient domain. DNS is public and the same for
 * every organization, so this table is global rather than org-scoped: one
 * lookup per domain serves every sender. Rows are refreshed once they pass
 * `MAILBOX_DOMAIN_TTL_MS`, since a domain can migrate between providers.
 */
export const mailboxDomain = pgTable("mailbox_domain", {
  /** Bare domain, lowercased, without the `@`. */
  domain: text("domain").primaryKey(),
  provider: text("provider").$type<MailboxProvider>().notNull(),
  /** The MX hostnames the lookup returned, lowest preference first. */
  mxHosts: jsonb("mx_hosts").$type<string[]>(),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});

export const IDEMPOTENCY_STATUSES = ["in_progress", "completed"] as const;
export type IdempotencyStatus = (typeof IDEMPOTENCY_STATUSES)[number];

/**
 * One `Idempotency-Key` header value seen on a send endpoint. Rows are
 * scoped to the organization, so every API key of an organization shares
 * the same keyspace. While the first request runs the row is `in_progress`;
 * once it has queued the send the 202 response is stored and replayed to
 * retries with the same key and payload for 24 hours. Expired rows are
 * taken over by the next request that reuses the key and purged lazily.
 */
export const idempotencyKey = pgTable(
  "idempotency_key",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Caller-supplied key, 1 to 256 characters, as given. */
    key: text("key").notNull(),
    /**
     * SHA-256 of the endpoint and canonical request body. A retry whose hash
     * differs is rejected instead of replayed.
     */
    requestHash: text("request_hash").notNull(),
    status: text("status").$type<IdempotencyStatus>().default("in_progress").notNull(),
    /** HTTP status and JSON body of the original response, set once completed. */
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [
    uniqueIndex("idempotencyKey_organizationId_key_uidx").on(table.organizationId, table.key),
    index("idempotencyKey_organizationId_expiresAt_idx").on(
      table.organizationId,
      table.expiresAt,
    ),
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
  attachments: many(emailAttachment),
}));

export const emailBatchRelations = relations(emailBatch, ({ one, many }) => ({
  user: one(user, { fields: [emailBatch.userId], references: [user.id] }),
  emails: many(email),
}));

export const emailEventRelations = relations(emailEvent, ({ one }) => ({
  email: one(email, { fields: [emailEvent.emailId], references: [email.id] }),
}));

export const emailAttachmentRelations = relations(emailAttachment, ({ one }) => ({
  email: one(email, { fields: [emailAttachment.emailId], references: [email.id] }),
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
