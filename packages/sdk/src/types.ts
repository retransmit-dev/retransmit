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
  status: EmailStatus;
  error: string | null;
  created_at: string;
  last_event_at: string | null;
  events: EmailEvent[];
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
