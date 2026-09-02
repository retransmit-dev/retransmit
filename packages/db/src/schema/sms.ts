import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
