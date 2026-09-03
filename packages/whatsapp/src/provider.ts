import type { WhatsappMedia, WhatsappMessageType, WhatsappTemplate } from "@retransmit/db/schema/whatsapp";

import { createMetaProvider } from "./providers/meta";

export interface WhatsappMessage {
  /** Our row id; doubles as the provider-side correlation id where supported. */
  id: string;
  /** Normalized E.164 recipient. */
  to: string;
  /** ISO 3166-1 alpha-2 destination country, null when undetected. */
  country: string | null;
  type: WhatsappMessageType;
  /** Body for `text`, caption for media. */
  text?: string | null;
  previewUrl?: boolean;
  template?: WhatsappTemplate | null;
  media?: WhatsappMedia | null;
}

/** Credentials of the connected number a message goes out from. */
export interface WhatsappSender {
  /** Provider-side id of the sending number (Meta `phone_number_id`). */
  phoneNumberId: string;
  /** Decrypted bearer token for that number's business account. */
  accessToken: string;
}

export interface WhatsappSendResult {
  providerMessageId?: string;
}

/**
 * One upstream WhatsApp Business API gateway. A provider is chosen by the
 * connected number (`whatsapp_account.provider`), not per message: the
 * number lives on one gateway. Implementations are pure config + HTTP;
 * everything stateful (accounts, queueing, retries, status) lives outside.
 */
export interface WhatsappProvider {
  /** Stable routing key stored on accounts and sent messages, e.g. `meta`. */
  key: string;
  name: string;
  /** Whether the deployment-level config this gateway needs is present. */
  isConfigured(): boolean;
  /** Cost in USD per message for the destination country (billing estimate). */
  costFor(country: string | null): number;
  send(message: WhatsappMessage, sender: WhatsappSender): Promise<WhatsappSendResult>;
}

/**
 * Every gateway we know how to talk to. To add one (a BSP, Twilio's
 * WhatsApp sender), implement `WhatsappProvider`, register it here and give
 * accounts on it that `provider` key.
 */
const registry: WhatsappProvider[] = [
  createMetaProvider({
    key: "meta",
    name: "Meta WhatsApp Cloud API",
    envPrefix: "WHATSAPP_META",
    // Meta bills per conversation window by category and country; this is a
    // flat placeholder until per-country rate cards are loaded.
    defaultCostUsd: 0.05,
  }),
];

export function allProviders(): WhatsappProvider[] {
  return registry;
}

export function getProvider(key: string): WhatsappProvider | undefined {
  return registry.find((provider) => provider.key === key);
}
