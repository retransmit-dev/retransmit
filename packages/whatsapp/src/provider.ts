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

export interface WhatsappSendResult {
  providerMessageId?: string;
}

/**
 * One upstream WhatsApp Business API gateway. Implementations are pure config
 * + HTTP; everything stateful (queueing, retries, status) lives outside.
 */
export interface WhatsappProvider {
  /** Stable routing key stored on sent messages, e.g. `meta`. */
  key: string;
  name: string;
  /** Whether the required credentials/env are present. */
  isConfigured(): boolean;
  /**
   * Cost in USD per message for the destination country, or null when this
   * provider cannot deliver there. WhatsApp is global, so a direct Meta
   * connection prices every country (including null = unknown country).
   */
  costFor(country: string | null): number | null;
  send(message: WhatsappMessage): Promise<WhatsappSendResult>;
}

/**
 * Every provider we know how to talk to. Routing picks by override flags
 * first, then price. To add a provider (Twilio's WhatsApp sender, a BSP),
 * implement `WhatsappProvider` and register it here.
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

/**
 * Picks the provider for a destination country:
 * 1. `WHATSAPP_FORCE_PROVIDER` routes everything through one provider (debugging).
 * 2. Otherwise the cheapest configured provider that covers the country.
 * Returns null when nothing can deliver there.
 */
export function selectProvider(country: string | null): WhatsappProvider | null {
  const configured = registry.filter((provider) => provider.isConfigured());

  const forced = process.env.WHATSAPP_FORCE_PROVIDER;
  if (forced) return configured.find((provider) => provider.key === forced) ?? null;

  const candidates = configured
    .map((provider) => ({ provider, cost: provider.costFor(country) }))
    .filter((entry): entry is { provider: WhatsappProvider; cost: number } => entry.cost !== null)
    .sort((a, b) => a.cost - b.cost);
  return candidates[0]?.provider ?? null;
}
