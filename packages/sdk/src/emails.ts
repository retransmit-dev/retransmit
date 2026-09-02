import type { Retransmit } from "./retransmit";
import type { GetEmailResponse, Result, SendEmailOptions, SendEmailResponse } from "./types";

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
}
