import {
  PinpointSMSVoiceV2Client,
  SendTextMessageCommand,
} from "@aws-sdk/client-pinpoint-sms-voice-v2";

import type { SmsProviderName } from "@retransmit/db/schema/sms";

import type { SmsMessage, SmsProvider, SmsSendResult } from "../provider";

/**
 * AWS End User Messaging SMS
 * (https://docs.aws.amazon.com/sms-voice/latest/userguide/what-is-service.html),
 * the service that took over SMS from Amazon SNS.
 *
 * It reaches every country AWS sells SMS in, so this provider is the global
 * fallback: it covers any destination, and the price makes the cheaper carrier
 * integrations (MTN, Orange) win wherever they are configured. The routing key
 * stays `aws_sns` and the public provider name stays `sns` because both are
 * persisted on every row already sent.
 *
 * Why not SNS `Publish`: it works, but its only delivery-status channel is
 * CloudWatch Logs, which cannot post to an HTTPS endpoint without a Lambda or
 * Firehose in between. End User Messaging publishes events to an SNS topic
 * through a configuration set, which our callback subscribes to exactly like
 * SES does — no forwarder to own. Origination identities (sender ids, numbers,
 * registrations) live in this API too, which is what `infra/setup-sms.sh`
 * drives.
 *
 * Credentials come from the default AWS provider chain, the same as SES.
 * Env:
 * - `SNS_SMS_REGION` — region to send from. Turns the provider on; SMS is only
 *   available in some regions, and the account's spend limit, sandbox status
 *   and origination identities are all per region.
 * - `SNS_SMS_CONFIGURATION_SET` — configuration set carrying the event
 *   destination that feeds delivery receipts back to
 *   `/v1/callbacks/sms/sns`. Without it a send still goes out, but its status
 *   never moves past `sent`. Created by `infra/setup-sms.sh`.
 * - `SNS_SMS_SENDER_ID` — default origination identity when the message
 *   carries no approved sender id of its own. Registered per country where
 *   carriers require it.
 * - `SNS_SMS_ORIGINATION_NUMBER` — a number owned in the region, used instead
 *   of a sender id for countries that reject alphanumeric ids (US, CA, ...).
 * - `SNS_SMS_TYPE` — `TRANSACTIONAL` (default) or `PROMOTIONAL`.
 * - `SNS_SMS_MAX_PRICE` — USD ceiling per message part; AWS drops sends above it.
 * - `SNS_SMS_COUNTRIES` — optional allowlist of ISO countries, e.g. `US,GB`.
 *   Unset means every destination, including undetected countries.
 * - `SNS_SMS_COST_PER_SMS` — USD price per segment used for routing.
 */
export interface SnsProviderOptions {
  key: string;
  /** Public provider name a caller can pin a send to. */
  family: SmsProviderName;
  name: string;
  /** Fallback cost when `SNS_SMS_COST_PER_SMS` is unset. */
  defaultCostUsd: number;
}

// One client per region: the region can change between env reloads in dev,
// and SMS settings are strictly regional.
const clients = new Map<string, PinpointSMSVoiceV2Client>();
function getClient(region: string): PinpointSMSVoiceV2Client {
  let client = clients.get(region);
  if (!client) {
    client = new PinpointSMSVoiceV2Client({ region });
    clients.set(region, client);
  }
  return client;
}

function allowedCountries(): Set<string> | null {
  const raw = process.env.SNS_SMS_COUNTRIES;
  if (!raw) return null;
  const list = raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  return list.length > 0 ? new Set(list) : null;
}

export function createSnsProvider(options: SnsProviderOptions): SmsProvider {
  const region = () => process.env.SNS_SMS_REGION;

  async function sendOne(to: string, message: SmsMessage): Promise<string | undefined> {
    const currentRegion = region();
    if (!currentRegion) throw new Error(`${options.name}: SNS_SMS_REGION is not set`);

    // The message's own sender id has already been checked against the
    // organization's approvals (see senders.ts), so it wins. A number beats a
    // sender id where one is configured, because the countries that need a
    // number reject alphanumeric ids outright.
    const originationIdentity =
      message.from ??
      process.env.SNS_SMS_ORIGINATION_NUMBER ??
      process.env.SNS_SMS_SENDER_ID ??
      undefined;
    const maxPrice = process.env.SNS_SMS_MAX_PRICE;

    const response = await getClient(currentRegion).send(
      new SendTextMessageCommand({
        DestinationPhoneNumber: to,
        MessageBody: message.text,
        MessageType: process.env.SNS_SMS_TYPE === "PROMOTIONAL" ? "PROMOTIONAL" : "TRANSACTIONAL",
        ...(originationIdentity ? { OriginationIdentity: originationIdentity } : {}),
        ...(process.env.SNS_SMS_CONFIGURATION_SET
          ? { ConfigurationSetName: process.env.SNS_SMS_CONFIGURATION_SET }
          : {}),
        ...(maxPrice ? { MaxPrice: maxPrice } : {}),
      }),
    );
    return response.MessageId;
  }

  async function send(message: SmsMessage): Promise<SmsSendResult> {
    // SendTextMessage takes one destination per call. Ids are stored joined so
    // a delivery record for any recipient still finds the row.
    const ids: string[] = [];
    for (const to of message.to) {
      try {
        const id = await sendOne(to, message);
        if (id) ids.push(id);
      } catch (cause) {
        const detail = cause instanceof Error ? cause.message : String(cause);
        throw new Error(`${options.name} send failed: ${detail}`);
      }
    }
    return { providerMessageId: ids.length ? ids.join(",") : undefined };
  }

  return {
    key: options.key,
    family: options.family,
    name: options.name,
    isConfigured() {
      return Boolean(region());
    },
    countries() {
      // Null means "every destination": AWS quotes anywhere it sells SMS,
      // which is what makes this the fallback. An SNS_SMS_COUNTRIES allowlist
      // narrows that to a fixed set.
      const allowed = allowedCountries();
      return allowed ? [...allowed].sort() : null;
    },
    costFor(country) {
      const allowed = allowedCountries();
      if (allowed && (!country || !allowed.has(country))) return null;
      const configured = Number(process.env.SNS_SMS_COST_PER_SMS);
      return Number.isFinite(configured) && configured > 0 ? configured : options.defaultCostUsd;
    },
    send,
  };
}
