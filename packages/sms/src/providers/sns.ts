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
 * The hosted launch exposes this provider only for an explicit country
 * allowlist (Cameroon by default). The routing key
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
 * - `SNS_SMS_REGION` — region to send from when the message does not name one.
 *   Turns the provider on; SMS is only available in some regions, and the
 *   account's spend limit, sandbox status and origination identities are all
 *   per region. A message carrying an approved sender id overrides it with
 *   the region that sender id was registered in, because an origination
 *   identity does not exist outside its own region.
 * - `SNS_SMS_CONFIGURATION_SET` — configuration set carrying the event
 *   destination that feeds delivery receipts back to
 *   `/v1/callbacks/sms/sns`. Without it a send still goes out, but its status
 *   never moves past `sent`. Created by `infra/setup-sms.sh`.
 * - `SNS_SMS_PROTECT_CONFIGURATION_ID` — AWS Protect configuration attached
 *   to this request. For the initial launch its country rules allow Cameroon
 *   and block every other destination.
 * - `SNS_SMS_TYPE` — `TRANSACTIONAL` (default) or `PROMOTIONAL`.
 * - `SNS_SMS_MAX_PRICE` — USD ceiling per message part; AWS drops sends above it.
 * - `SNS_SMS_COUNTRIES` — destination allowlist. Unset defaults to `CM`.
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

function allowedCountries(): Set<string> {
  const raw = process.env.SNS_SMS_COUNTRIES;
  // The hosted launch is Cameroon-only. An unset environment must fail
  // closed, not silently turn AWS back into a worldwide fallback.
  if (!raw) return new Set(["CM"]);
  const list = raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  return list.length > 0 ? new Set(list) : new Set(["CM"]);
}

export function createSnsProvider(options: SnsProviderOptions): SmsProvider {
  // Env only answers "is this route on, and where does an unattributed
  // message go". A message that names a region wins, so the send lands in the
  // region its origination identity lives in.
  const defaultRegion = () => process.env.SNS_SMS_REGION;
  const regionFor = (message: SmsMessage) => message.region || defaultRegion();

  async function sendOne(to: string, message: SmsMessage): Promise<string | undefined> {
    const currentRegion = regionFor(message);
    if (!currentRegion) throw new Error(`${options.name}: SNS_SMS_REGION is not set`);
    const protectConfigurationId = process.env.SNS_SMS_PROTECT_CONFIGURATION_ID;
    if (!protectConfigurationId) {
      throw new Error(`${options.name}: SNS_SMS_PROTECT_CONFIGURATION_ID is not set`);
    }

    // The message's own sender id has already been checked against the
    // organization's approvals (see senders.ts), so it wins. A number beats a
    // sender id where one is configured, because the countries that need a
    // number reject alphanumeric ids outright.
    const originationIdentity = message.from;
    if (!originationIdentity) {
      throw new Error(`${options.name}: an approved origination identity is required`);
    }
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
        ProtectConfigurationId: protectConfigurationId,
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
        // The spend limit, the sandbox and the sender id registration are all
        // per region, so which region this was is half the answer to why it
        // failed. Without it the message reads as an account-wide problem.
        throw new Error(`${options.name} send failed in ${regionFor(message)}: ${detail}`);
      }
    }
    return {
      providerMessageId: ids.length ? ids.join(",") : undefined,
      region: regionFor(message),
    };
  }

  return {
    key: options.key,
    family: options.family,
    name: options.name,
    isConfigured() {
      return Boolean(defaultRegion() && process.env.SNS_SMS_PROTECT_CONFIGURATION_ID);
    },
    countries() {
      return [...allowedCountries()].sort();
    },
    costFor(country) {
      const allowed = allowedCountries();
      if (!country || !allowed.has(country)) return null;
      const configured = Number(process.env.SNS_SMS_COST_PER_SMS);
      return Number.isFinite(configured) && configured > 0 ? configured : options.defaultCostUsd;
    },
    send,
  };
}
