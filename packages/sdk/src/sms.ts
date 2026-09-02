import type { Retransmit } from "./retransmit";
import type { GetSmsResponse, Result, SendSmsOptions, SendSmsResponse } from "./types";

export class Sms {
  constructor(private readonly client: Retransmit) {}

  /** Queues a single SMS. Poll `get(id)` or subscribe to webhooks for the outcome. */
  send(options: SendSmsOptions): Promise<Result<SendSmsResponse>> {
    return this.client.request("POST", "/v1/sms", {
      from: options.from,
      to: options.to,
      text: options.text,
    });
  }

  /** Retrieves an SMS with its current status and event history. */
  get(id: string): Promise<Result<GetSmsResponse>> {
    return this.client.request("GET", `/v1/sms/${encodeURIComponent(id)}`);
  }
}
