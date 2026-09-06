import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

import type { SmsMessage, SmsProvider, SmsSendResult } from "../provider";

/**
 * Amazon SNS SMS (https://docs.aws.amazon.com/sns/latest/dg/sns-mobile-phone-number-as-subscriber.html).
 *
 * SNS reaches every country AWS sells SMS in, so this provider is the global
 * fallback: it covers any destination, and the price makes the cheaper
 * carrier integrations (MTN, Orange) win wherever they are configured.
 *
 * Credentials come from the default AWS provider chain, the same as SES.
 * Env:
 * - `SNS_SMS_REGION` — region to publish from. Turns the provider on; SMS is
 *   only available in some regions (eu-central-1, us-east-1, ap-southeast-1
 *   and others), and the account's spend limit and origination identities
 *   are per region.
 * - `SNS_SMS_SENDER_ID` — default alphanumeric sender id (max 11 chars).
 *   Registered per country where carriers require it; ignored elsewhere.
 * - `SNS_SMS_ORIGINATION_NUMBER` — an origination number owned in the
 *   region, for countries that require one (US, CA, ...).
 * - `SNS_SMS_TYPE` — `Transactional` (default) or `Promotional`.
 * - `SNS_SMS_MAX_PRICE` — USD ceiling per message; SNS drops sends above it.
 * - `SNS_SMS_COUNTRIES` — optional allowlist of ISO countries, e.g. `US,GB`.
 *   Unset means every destination, including undetected countries.
 * - `SNS_SMS_COST_PER_SMS` — USD price per segment used for routing.
 *
 * Delivery receipts: SNS writes SMS delivery status to CloudWatch Logs
 * (enable "Delivery status logging" in SNS > Text messaging preferences).
 * Forward those records to `/v1/callbacks/sms/sns` to close the loop; see
 * `processSnsDeliveryReceipt` in delivery.ts.
 */
export interface SnsProviderOptions {
  key: string;
  name: string;
  /** Fallback cost when `SNS_SMS_COST_PER_SMS` is unset. */
  defaultCostUsd: number;
}

// One client per region: the region can change between env reloads in dev,
// and SNS SMS settings are strictly regional.
const clients = new Map<string, SNSClient>();
function getClient(region: string): SNSClient {
  let client = clients.get(region);
  if (!client) {
    client = new SNSClient({ region });
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

    const senderId = message.from ?? process.env.SNS_SMS_SENDER_ID;
    const originationNumber = process.env.SNS_SMS_ORIGINATION_NUMBER;
    const maxPrice = process.env.SNS_SMS_MAX_PRICE;
    const smsType = process.env.SNS_SMS_TYPE === "Promotional" ? "Promotional" : "Transactional";

    const response = await getClient(currentRegion).send(
      new PublishCommand({
        PhoneNumber: to,
        Message: message.text,
        MessageAttributes: {
          "AWS.SNS.SMS.SMSType": { DataType: "String", StringValue: smsType },
          ...(senderId
            ? { "AWS.SNS.SMS.SenderID": { DataType: "String", StringValue: senderId } }
            : {}),
          ...(originationNumber
            ? {
                "AWS.MM.SMS.OriginationNumber": {
                  DataType: "String",
                  StringValue: originationNumber,
                },
              }
            : {}),
          ...(maxPrice
            ? { "AWS.SNS.SMS.MaxPrice": { DataType: "Number", StringValue: maxPrice } }
            : {}),
        },
      }),
    );
    return response.MessageId;
  }

  async function send(message: SmsMessage): Promise<SmsSendResult> {
    // Publish takes one PhoneNumber per call. Ids are stored joined so a
    // delivery record for any recipient still finds the row.
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
    name: options.name,
    isConfigured() {
      return Boolean(region());
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
