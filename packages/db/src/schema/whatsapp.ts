import { relations } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { organization, user } from "./auth";
import { apiKey } from "./email";
import type { WebhookEventType } from "./email";

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
    index("whatsappMessage_to_createdAt_idx").on(table.to, table.createdAt),
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
 * Messages people send to the platform number. The sending business is
 * resolved from the conversation (a quoted message of ours, else the last
 * outbound to that number); rows that cannot be attributed keep a null user
 * and never reach a webhook.
 */
export const whatsappInbound = pgTable(
  "whatsapp_inbound",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    provider: text("provider").notNull(),
    /** Upstream message id; unique so redelivered notifications are dropped. */
    providerMessageId: text("provider_message_id").notNull(),
    /** Sender, normalized E.164. */
    from: text("from").notNull(),
    /** The platform number that received it (display form, e.g. `+15550001234`). */
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
    index("whatsappInbound_userId_createdAt_idx").on(table.userId, table.createdAt),
  ],
);

export const whatsappMessageRelations = relations(whatsappMessage, ({ one, many }) => ({
  user: one(user, { fields: [whatsappMessage.userId], references: [user.id] }),
  apiKey: one(apiKey, { fields: [whatsappMessage.apiKeyId], references: [apiKey.id] }),
  events: many(whatsappEvent),
}));

export const whatsappEventRelations = relations(whatsappEvent, ({ one }) => ({
  message: one(whatsappMessage, {
    fields: [whatsappEvent.messageId],
    references: [whatsappMessage.id],
  }),
}));

export const whatsappInboundRelations = relations(whatsappInbound, ({ one }) => ({
  user: one(user, { fields: [whatsappInbound.userId], references: [user.id] }),
  replyTo: one(whatsappMessage, {
    fields: [whatsappInbound.replyToMessageId],
    references: [whatsappMessage.id],
  }),
}));
