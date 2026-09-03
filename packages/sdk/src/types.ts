/**
 * Response and payload types mirror the public API wire format
 * (snake_case fields, ISO 8601 timestamps). Kept standalone on purpose:
 * this package is published to npm and cannot import workspace packages.
 */

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

export interface RetransmitError {
  code: string;
  message: string;
}

export type Result<T> = { data: T; error: null } | { data: null; error: RetransmitError };

export interface RetransmitOptions {
  /** Override the API origin. Defaults to `https://api.retransmit.dev` (or `RETRANSMIT_BASE_URL`). */
  baseUrl?: string;
}

export interface SendEmailOptions {
  /** Sender, as `address@domain.com` or `Name <address@domain.com>`. The domain must be verified on your account. */
  from: string;
  /** One recipient or up to 50. */
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string | string[];
  subject: string;
  /** HTML body. At least one of `html` or `text` is required. */
  html?: string;
  /** Plain-text body. At least one of `html` or `text` is required. */
  text?: string;
  /**
   * Mark this as a marketing email. Retransmit replaces `{{{unsubscribe_url}}}`
   * in the body with a hosted unsubscribe link, adds one-click List-Unsubscribe
   * headers, and skips recipients who already unsubscribed.
   */
  marketing?: boolean;
  /**
   * Up to 10 labels for filtering in the dashboard and API, for example
   * `[{ name: "campaign", value: "outreach-1" }]`. Names and values allow
   * letters, digits, underscores and dashes, up to 256 characters each.
   * Tags are never sent to the recipient.
   */
  tags?: EmailTag[];
}

export interface EmailTag {
  name: string;
  value: string;
}

export interface SendEmailResponse {
  id: string;
  status: "queued";
  created_at: string;
}

export interface EmailEvent {
  type: string;
  created_at: string;
}

export interface GetEmailResponse {
  id: string;
  batch_id: string | null;
  from: string;
  to: string[];
  cc: string[] | null;
  bcc: string[] | null;
  reply_to: string[] | null;
  subject: string;
  marketing: boolean;
  tags: EmailTag[];
  status: EmailStatus;
  error: string | null;
  created_at: string;
  last_event_at: string | null;
  events: EmailEvent[];
}

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

export interface SendSmsOptions {
  /**
   * Sender id shown on the recipient's device (up to 11 characters:
   * letters, digits, space, - and _). Defaults to the sender configured for
   * the routed provider.
   */
  from?: string;
  /** One recipient or up to 50, in international format (`+237670000000`). All must share one country. */
  to: string | string[];
  text: string;
}

export interface SendSmsResponse {
  id: string;
  status: "queued";
  /** ISO 3166-1 alpha-2 destination country detected from the number prefix. */
  country: string | null;
  /** Billable message parts. */
  segments: number;
  created_at: string;
}

export interface SmsEvent {
  type: string;
  created_at: string;
}

export interface GetSmsResponse {
  id: string;
  from: string | null;
  to: string[];
  text: string;
  country: string | null;
  segments: number;
  /** Upstream provider that carried the message, e.g. `mtn_cm`. */
  provider: string | null;
  status: SmsStatus;
  error: string | null;
  created_at: string;
  last_event_at: string | null;
  events: SmsEvent[];
}

export const WHATSAPP_STATUSES = ["queued", "sent", "delivered", "read", "failed"] as const;
export type WhatsappStatus = (typeof WHATSAPP_STATUSES)[number];

export type WhatsappMessageType = "text" | "template" | "image" | "document";

export interface WhatsappTemplate {
  /** Template name as approved in WhatsApp Manager. */
  name: string;
  /** Language code the template was approved for, e.g. `en_US`. */
  language: string;
  /** Meta `components` (header/body/button parameters), passed through verbatim. */
  components?: Record<string, unknown>[];
}

export interface WhatsappMedia {
  /** Public HTTPS link fetched at send time. */
  link: string;
  caption?: string;
}

export interface WhatsappDocument extends WhatsappMedia {
  /** File name shown to the recipient. */
  filename?: string;
}

export interface SendWhatsappOptions {
  /**
   * Connected number to send from, in international format. Optional when
   * your organization has a single WhatsApp number.
   */
  from?: string;
  /** One recipient in international format (`+237670000000`). */
  to: string;
  /** Defaults to `text`. */
  type?: WhatsappMessageType;
  /** Body for `text` messages (up to 4,096 characters), or a media caption. */
  text?: string;
  /** Render a preview for the first link in a `text` message. */
  previewUrl?: boolean;
  /** Required for `type: "template"`. Needed to start a conversation outside the 24h window. */
  template?: WhatsappTemplate;
  /** Required for `type: "image"`. */
  image?: WhatsappMedia;
  /** Required for `type: "document"`. */
  document?: WhatsappDocument;
}

export interface SendWhatsappResponse {
  id: string;
  status: "queued";
  type: WhatsappMessageType;
  /** The connected number the message goes out from. */
  from: string;
  /** ISO 3166-1 alpha-2 destination country detected from the number prefix. */
  country: string | null;
  created_at: string;
}

export interface WhatsappEvent {
  type: string;
  created_at: string;
}

export interface GetWhatsappResponse {
  id: string;
  from: string;
  to: string;
  country: string | null;
  type: WhatsappMessageType;
  text: string | null;
  preview_url: boolean;
  template: WhatsappTemplate | null;
  media: WhatsappDocument | null;
  /** Upstream provider that carried the message, e.g. `meta`. */
  provider: string | null;
  /** Provider-side message id (`wamid.…` on Meta); inbound replies reference it. */
  provider_message_id: string | null;
  status: WhatsappStatus;
  error: string | null;
  created_at: string;
  last_event_at: string | null;
  events: WhatsappEvent[];
}

export interface SendBatchResponse {
  id: string;
  total: number;
  status: "queued";
  created_at: string;
}

export interface GetBatchResponse {
  id: string;
  total: number;
  /** Emails that have left the queue (any status other than `queued`/`scheduled`). */
  processed: number;
  /** Email count per status, e.g. `{ queued: 4, delivered: 96 }`. */
  counts: Partial<Record<EmailStatus, number>>;
  created_at: string;
}
