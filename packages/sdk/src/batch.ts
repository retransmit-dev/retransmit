import { toWirePayload } from "./emails";
import type { Retransmit } from "./retransmit";
import type { GetBatchResponse, Result, SendBatchResponse, SendEmailOptions } from "./types";

export class Batch {
  constructor(private readonly client: Retransmit) {}

  /** Queues up to 10,000 emails in one request. Track progress with `get(id)`. */
  send(emails: SendEmailOptions[]): Promise<Result<SendBatchResponse>> {
    return this.client.request("POST", "/v1/emails/batch", {
      emails: emails.map(toWirePayload),
    });
  }

  /** Batch progress: how many emails are in each status so far. */
  get(id: string): Promise<Result<GetBatchResponse>> {
    return this.client.request("GET", `/v1/emails/batch/${encodeURIComponent(id)}`);
  }
}
