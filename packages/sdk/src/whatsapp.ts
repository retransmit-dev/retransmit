import type { Retransmit } from "./retransmit";
import type {
  GetWhatsappResponse,
  Result,
  SendWhatsappOptions,
  SendWhatsappResponse,
} from "./types";

export class Whatsapp {
  constructor(private readonly client: Retransmit) {}

  /**
   * Queues a single WhatsApp message to one recipient. Poll `get(id)` or
   * subscribe to webhooks for the outcome; replies arrive as
   * `whatsapp.received` webhooks.
   */
  send(options: SendWhatsappOptions): Promise<Result<SendWhatsappResponse>> {
    return this.client.request("POST", "/v1/whatsapp", {
      to: options.to,
      type: options.type,
      text: options.text,
      preview_url: options.previewUrl,
      template: options.template,
      image: options.image,
      document: options.document,
    });
  }

  /** Retrieves a WhatsApp message with its current status and event history. */
  get(id: string): Promise<Result<GetWhatsappResponse>> {
    return this.client.request("GET", `/v1/whatsapp/${encodeURIComponent(id)}`);
  }
}
