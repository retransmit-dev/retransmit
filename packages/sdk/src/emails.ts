import type { Retransmit } from "./retransmit";
import type {
  GetEmailResponse,
  ListEmailTagsResponse,
  ListEmailsOptions,
  ListEmailsResponse,
  Result,
  SendEmailOptions,
  SendEmailResponse,
} from "./types";

/** Maps the camelCase SDK options onto the snake_case wire format. */
export function toWirePayload(options: SendEmailOptions) {
  return {
    from: options.from,
    to: options.to,
    cc: options.cc,
    bcc: options.bcc,
    reply_to: options.replyTo,
    subject: options.subject,
    html: options.html,
    text: options.text,
    marketing: options.marketing,
    tags: options.tags,
  };
}

export class Emails {
  constructor(private readonly client: Retransmit) {}

  /** Queues a single email. Poll `get(id)` or subscribe to webhooks for the outcome. */
  send(options: SendEmailOptions): Promise<Result<SendEmailResponse>> {
    return this.client.request("POST", "/v1/emails", toWirePayload(options));
  }

  /** Retrieves an email with its current status and event history. */
  get(id: string): Promise<Result<GetEmailResponse>> {
    return this.client.request("GET", `/v1/emails/${encodeURIComponent(id)}`);
  }

  /**
   * Lists your emails, newest first, optionally filtered by tags, status or
   * batch. Pass `next_cursor` back as `cursor` to page through the results.
   */
  list(options: ListEmailsOptions = {}): Promise<Result<ListEmailsResponse>> {
    return this.client.request("GET", "/v1/emails", undefined, {
      tag: options.tags?.map((tag) => `${tag.name}:${tag.value}`),
      status: options.status,
      batch_id: options.batchId,
      limit: options.limit,
      cursor: options.cursor,
    });
  }

  /** Every distinct tag on your emails, with a count of emails carrying it. */
  tags(): Promise<Result<ListEmailTagsResponse>> {
    return this.client.request("GET", "/v1/emails/tags");
  }
}
