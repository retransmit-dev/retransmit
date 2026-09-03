import { relations } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { organization, user } from "./auth";
import { apiKey } from "./email";
import type { WebhookEventType } from "./email";

export const WHATSAPP_ACCOUNT_STATUSES = ["active", "disconnected"] as const;
export type WhatsappAccountStatus = (typeof WHATSAPP_ACCOUNT_STATUSES)[number];

/**
 * How the number came to be on the account. `embedded_signup` is a number the
 * customer owns and verified through Meta's Embedded Signup; `provisioned` is
 * reserved for numbers Retransmit buys and registers on the customer's
 * behalf (not built yet).
 */
export const WHATSAPP_ACCOUNT_SOURCES = ["embedded_signup", "provisioned"] as const;
export type WhatsappAccountSource = (typeof WHATSAPP_ACCOUNT_SOURCES)[number];

/**
 * A WhatsApp Business phone number connected to an organization. Each
 * organization brings its own number (and WhatsApp Business Account) through
 * Embedded Signup under Retransmit's Meta app, so messages go out with the
 * customer's name and replies are unambiguous.
 */
export const whatsappAccount = pgTable(
  "whatsapp_account",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Member who connected the number; inbound webhooks go to this user's endpoints. */
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Routing key of the gateway that serves this number, e.g. `meta`. */
    provider: text("provider").notNull(),
    source: text("source").$type<WhatsappAccountSource>().default("embedded_signup").notNull(),
    /** WhatsApp Business Account id the number belongs to. */
    wabaId: text("waba_id").notNull(),
    /** Meta phone number id; webhooks identify the receiving number by it. */
    phoneNumberId: text("phone_number_id").notNull(),
    /** The number itself, normalized E.164. */
    phoneNumber: text("phone_number").notNull(),
    /** Business display name approved by Meta for the number. */
    verifiedName: text("verified_name"),
    /** Meta quality rating: GREEN, YELLOW, RED or UNKNOWN. */
    qualityRating: text("quality_rating"),
    /** Encrypted business integration token (see @retransmit/whatsapp/crypto). */
    accessToken: text("access_token").notNull(),
    /** Two-step verification PIN set at registration, encrypted like the token. */
    pin: text("pin"),
    status: text("status").$type<WhatsappAccountStatus>().default("active").notNull(),
    /** Last error from Meta when syncing or registering, for the dashboard. */
    error: text("error"),
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("whatsappAccount_provider_phoneNumberId_idx").on(
      table.provider,
      table.phoneNumberId,
    ),
    index("whatsappAccount_organizationId_idx").on(table.organizationId),
  ],
);

export const WHATSAPP_STATUSES = ["queued", "sent", "delivered", "read", "failed"] as const;
export type WhatsappStatus = (typeof WHATSAPP_STATUSES)[number];

/** Outbound message kinds we accept on the API. */
export const WHATSAPP_MESSAGE_TYPES = ["text", "template", "image", "document"] as const;
export type WhatsappMessageType = (typeof WHATSAPP_MESSAGE_TYPES)[number];

/** Meta template reference (business-initiated messages outside the 24h window). */
export interface WhatsappTemplate {
  name: string;
  /** BCP-47 language code the template was approved for, e.g. `en_US`. */
  language: string;
  /** Meta `components` array (header/body/button parameters), passed through verbatim. */
  components?: Record<string, unknown>[];
}

/** Media sent by public link (Meta downloads it at send time). */
export interface WhatsappMedia {
  link: string;
  caption?: string;
  /** Documents only: file name shown to the recipient. */
  filename?: string;
}

export const whatsappMessage = pgTable(
  "whatsapp_message",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    apiKeyId: text("api_key_id").references(() => apiKey.id, { onDelete: "set null" }),
    /** The connected number this went out from. Null once that number is disconnected. */
    accountId: text("account_id").references(() => whatsappAccount.id, { onDelete: "set null" }),
    /** Sending number at the time of sending, normalized E.164. */
    from: text("from").notNull(),
    /** Recipient, normalized E.164 (`+2376...`). One row per recipient. */
    to: text("to").notNull(),
    /** ISO 3166-1 alpha-2 destination country detected from the number. */
    country: text("country"),
    type: text("type").$type<WhatsappMessageType>().default("text").notNull(),
    /** Body for `text` messages, caption for media. */
    text: text("text"),
    /** Whether link previews render for `text` messages. */
    previewUrl: boolean("preview_url").default(false).notNull(),
    template: jsonb("template").$type<WhatsappTemplate>(),
    media: jsonb("media").$type<WhatsappMedia>(),
    /** Routing key of the provider that carried the message, e.g. `meta`. */
    provider: text("provider"),
    /** Message id assigned upstream (`wamid.…` for Meta); status callbacks key on it. */
    providerMessageId: text("provider_message_id"),
    status: text("status").$type<WhatsappStatus>().default("queued").notNull(),
    error: text("error"),
    lastEventAt: timestamp("last_event_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("whatsappMessage_userId_createdAt_idx").on(table.userId, table.createdAt),
    index("whatsappMessage_providerMessageId_idx").on(table.providerMessageId),
    index("whatsappMessage_userId_status_idx").on(table.userId, table.status),
    index("whatsappMessage_accountId_createdAt_idx").on(table.accountId, table.createdAt),
  ],
);

export const whatsappEvent = pgTable(
  "whatsapp_event",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => whatsappMessage.id, { onDelete: "cascade" }),
    type: text("type").$type<WebhookEventType>().notNull(),
    /** Raw provider payload (status notification) for debugging and display. */
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("whatsappEvent_messageId_idx").on(table.messageId)],
);

/**
 * Messages people send to a connected number. The receiving number's
 * `phone_number_id` identifies the account; notifications for a number we
 * no longer know are stored without an owner and never reach a webhook.
 */
export const whatsappInbound = pgTable(
  "whatsapp_inbound",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").references(() => whatsappAccount.id, { onDelete: "set null" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    provider: text("provider").notNull(),
    /** Upstream message id; unique so redelivered notifications are dropped. */
    providerMessageId: text("provider_message_id").notNull(),
    /** Sender, normalized E.164. */
    from: text("from").notNull(),
    /** The connected number that received it, normalized E.164. */
    to: text("to"),
    /** WhatsApp profile name of the sender, when shared. */
    profileName: text("profile_name"),
    /** Meta message type: text, image, button, interactive, reaction, ... */
    type: text("type").notNull(),
    /** Text body, caption, button title or reaction emoji, depending on `type`. */
    text: text("text"),
    /** Our outbound message the sender replied to, when they quoted one. */
    replyToMessageId: text("reply_to_message_id").references(() => whatsappMessage.id, {
      onDelete: "set null",
    }),
    /** Raw message object from the provider. */
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    /** Timestamp reported by the provider. */
    receivedAt: timestamp("received_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("whatsappInbound_provider_providerMessageId_idx").on(
      table.provider,
      table.providerMessageId,
    ),
    index("whatsappInbound_accountId_createdAt_idx").on(table.accountId, table.createdAt),
  ],
);

export const whatsappAccountRelations = relations(whatsappAccount, ({ one, many }) => ({
  organization: one(organization, {
    fields: [whatsappAccount.organizationId],
    references: [organization.id],
  }),
  user: one(user, { fields: [whatsappAccount.userId], references: [user.id] }),
  messages: many(whatsappMessage),
  inbound: many(whatsappInbound),
}));

export const whatsappMessageRelations = relations(whatsappMessage, ({ one, many }) => ({
  user: one(user, { fields: [whatsappMessage.userId], references: [user.id] }),
  apiKey: one(apiKey, { fields: [whatsappMessage.apiKeyId], references: [apiKey.id] }),
  account: one(whatsappAccount, {
    fields: [whatsappMessage.accountId],
    references: [whatsappAccount.id],
  }),
  events: many(whatsappEvent),
}));

export const whatsappEventRelations = relations(whatsappEvent, ({ one }) => ({
  message: one(whatsappMessage, {
    fields: [whatsappEvent.messageId],
    references: [whatsappMessage.id],
  }),
}));

export const whatsappInboundRelations = relations(whatsappInbound, ({ one }) => ({
  account: one(whatsappAccount, {
    fields: [whatsappInbound.accountId],
    references: [whatsappAccount.id],
  }),
  user: one(user, { fields: [whatsappInbound.userId], references: [user.id] }),
  replyTo: one(whatsappMessage, {
    fields: [whatsappInbound.replyToMessageId],
    references: [whatsappMessage.id],
  }),
}));
