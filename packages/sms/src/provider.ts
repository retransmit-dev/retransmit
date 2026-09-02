import { createMtnProvider } from "./providers/mtn";

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
 * by override flags first, then price. To add a provider (Orange, Twilio, an
 * MTN opco in another country), implement `SmsProvider` and register it here.
 */
const registry: SmsProvider[] = [
  createMtnProvider({
    key: "mtn_cm",
    name: "MTN Cameroon",
    envPrefix: "MTN_CM",
    countries: ["CM"],
    defaultCostUsd: 0.01,
  }),
];

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

/**
 * Picks the provider for a destination country:
 * 1. `SMS_FORCE_PROVIDER` routes everything through one provider (debugging).
 * 2. An `SMS_ROUTES` country pin wins for its country.
 * 3. Otherwise the cheapest configured provider that covers the country.
 * Returns null when nothing can deliver there.
 */
export function selectProvider(country: string | null): SmsProvider | null {
  const configured = registry.filter((provider) => provider.isConfigured());

  const forced = process.env.SMS_FORCE_PROVIDER;
  if (forced) return configured.find((provider) => provider.key === forced) ?? null;

  if (country) {
    const pinned = routeOverrides().get(country);
    if (pinned) {
      const provider = configured.find((candidate) => candidate.key === pinned);
      if (provider && provider.costFor(country) !== null) return provider;
    }
  }

  const candidates = configured
    .map((provider) => ({ provider, cost: provider.costFor(country) }))
    .filter((entry): entry is { provider: SmsProvider; cost: number } => entry.cost !== null)
    .sort((a, b) => a.cost - b.cost);
  return candidates[0]?.provider ?? null;
}
