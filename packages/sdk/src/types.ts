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
