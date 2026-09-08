import type { SmsProviderName } from "@retransmit/db/schema/sms";

import { createMtnProvider } from "./providers/mtn";
import { createOrangeProvider } from "./providers/orange";
import { createSnsProvider } from "./providers/sns";

/**
 * The names a caller may pin a send to are carrier-level, not per-opco:
 * `mtn` covers every MTN integration and routing still picks the opco that
 * covers the destination country, so adding an opco never changes the public
 * contract. `SMS_PROVIDER_NAMES` lives with the column that stores it, in
 * @retransmit/db/schema/sms.
 */
export type { SmsProviderName };

export interface SmsMessage {
  /** Our row id; doubles as the provider-side correlation/idempotency id. */
  id: string;
  /** Sender id shown on the device. Providers fall back to their configured default. */
  from?: string | null;
  /** Normalized E.164 recipients. */
  to: string[];
  text: string;
  /** ISO 3166-1 alpha-2 destination country, null when undetected. */
  country: string | null;
}

export interface SmsSendResult {
  providerMessageId?: string;
}

/**
 * One upstream SMS carrier or aggregator. Implementations are pure config +
 * HTTP; everything stateful (queueing, retries, status) lives outside.
 */
export interface SmsProvider {
  /** Stable routing key stored on sent messages, e.g. `mtn_cm`. */
  key: string;
  /** Public name a caller can pin a send to; several opcos share one. */
  family: SmsProviderName;
  name: string;
  /** Whether the required credentials/env are present. */
  isConfigured(): boolean;
  /**
   * Cost in USD per message segment for the destination country, or null when
   * this provider cannot deliver there. A global aggregator returns a price
   * for every country (including null = unknown country).
   */
  costFor(country: string | null): number | null;
  send(message: SmsMessage): Promise<SmsSendResult>;
}

/**
 * Every provider we know how to talk to. Order is irrelevant — routing picks
 * by override flags first, then price. To add a provider (Twilio, an MTN or
 * Orange opco in another country), implement `SmsProvider` and register it
 * here.
 */
const registry: SmsProvider[] = [
  createMtnProvider({
    key: "mtn_cm",
    family: "mtn",
    name: "MTN Cameroon",
    envPrefix: "MTN_CM",
    countries: ["CM"],
    defaultCostUsd: 0.01,
  }),
  createOrangeProvider({
    key: "orange_cm",
    family: "orange",
    name: "Orange Cameroon",
    envPrefix: "ORANGE_CM",
    countries: ["CM"],
    defaultSenderAddress: "+2370000",
    // Orange sells prepaid bundles in XAF; set ORANGE_CM_COST_PER_SMS once the
    // per-unit price of the purchased bundle is known.
    defaultCostUsd: 0.02,
  }),
  createSnsProvider({
    key: "aws_sns",
    family: "sns",
    name: "Amazon SNS",
    // Priced above the carrier integrations so it only wins where they do
    // not deliver; SNS list prices sit between $0.02 and $0.10 per segment.
    defaultCostUsd: 0.05,
  }),
];

/** Display label for a routing key, for logs and tables. Falls back to the key. */
export function providerLabel(key: string): string {
  return registry.find((provider) => provider.key === key)?.name ?? key;
}

export function allProviders(): SmsProvider[] {
  return registry;
}

export function getProvider(key: string): SmsProvider | undefined {
  return registry.find((provider) => provider.key === key);
}

/** `SMS_ROUTES="CM=mtn_cm,GA=orange_ga"` — hard per-country routing pins. */
function routeOverrides(): Map<string, string> {
  const overrides = new Map<string, string>();
  for (const entry of (process.env.SMS_ROUTES ?? "").split(",")) {
    const [country, key] = entry.split("=").map((part) => part.trim());
    if (country && key) overrides.set(country.toUpperCase(), key);
  }
  return overrides;
}

/** Cheapest of the given providers that can deliver to `country`. */
function cheapestFor(providers: SmsProvider[], country: string | null): SmsProvider | null {
  const candidates = providers
    .map((provider) => ({ provider, cost: provider.costFor(country) }))
    .filter((entry): entry is { provider: SmsProvider; cost: number } => entry.cost !== null)
    .sort((a, b) => a.cost - b.cost);
  return candidates[0]?.provider ?? null;
}

/**
 * Picks the provider for a destination country:
 * 1. `preferred` pins the send to one carrier — the cheapest configured opco
 *    of that carrier covering the country, or null. A caller who names a
 *    provider gets it or an error, never a silent fallback to another one.
 * 2. `SMS_FORCE_PROVIDER` routes everything else through one provider
 *    (debugging); it does not override an explicit `preferred`.
 * 3. An `SMS_ROUTES` country pin wins for its country.
 * 4. Otherwise the cheapest configured provider that covers the country.
 * Returns null when nothing can deliver there.
 */
export function selectProvider(
  country: string | null,
  preferred?: SmsProviderName | null,
): SmsProvider | null {
  const configured = registry.filter((provider) => provider.isConfigured());

  if (preferred) {
    const family = configured.filter((provider) => provider.family === preferred);
    return cheapestFor(family, country);
  }

  const forced = process.env.SMS_FORCE_PROVIDER;
  if (forced) return configured.find((provider) => provider.key === forced) ?? null;

  if (country) {
    const pinned = routeOverrides().get(country);
    if (pinned) {
      const provider = configured.find((candidate) => candidate.key === pinned);
      if (provider && provider.costFor(country) !== null) return provider;
    }
  }

  return cheapestFor(configured, country);
}
