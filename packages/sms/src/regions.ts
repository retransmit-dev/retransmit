/**
 * AWS regions Retransmit can send SMS from.
 *
 * The reason this exists is not latency: AWS charges the same per destination
 * everywhere, so where a message originates barely shows on the handset. It
 * is that an origination identity is a *regional* resource. A sender id
 * registered in `af-south-1` does not exist in `eu-central-1`, and sending
 * with it from the wrong region fails outright. So the region a sender id was
 * registered in has to travel with the sender id, exactly like an SES
 * identity carries the region its domain was verified into.
 *
 * Sandbox status and the monthly spend limit are per region too, which is
 * mostly an operator concern but the same fact.
 *
 * This list must stay in step with the regions `infra/setup-sms.sh`
 * provisions: a region with no configuration set has no delivery receipts, so
 * every message sent from it would sit at `sent` forever.
 *
 * Kept free of AWS SDK imports so it can be served straight to the dashboard.
 */
export const SMS_REGIONS = [
  { id: "eu-central-1", name: "Europe", location: "Frankfurt", flag: "🇩🇪" },
  { id: "us-east-1", name: "United States", location: "N. Virginia", flag: "🇺🇸" },
  { id: "ap-southeast-1", name: "Asia Pacific", location: "Singapore", flag: "🇸🇬" },
  { id: "af-south-1", name: "Africa", location: "Cape Town", flag: "🇿🇦" },
] as const;

export type SmsRegion = (typeof SMS_REGIONS)[number]["id"];

export const SMS_REGION_IDS = SMS_REGIONS.map((region) => region.id) as [SmsRegion, ...SmsRegion[]];

export function isSmsRegion(value: string): value is SmsRegion {
  return (SMS_REGION_IDS as string[]).includes(value);
}

/**
 * Region a send falls back to when nothing on the message names one, and the
 * one pre-selected in the dashboard.
 *
 * Note this is not the same question as "is the AWS route configured": the
 * provider still gates itself on `SNS_SMS_REGION` being set, because an
 * unset value has to mean "off", not "use the fallback". This constant only
 * answers "which region, given that we are sending".
 */
export const DEFAULT_SMS_REGION: SmsRegion = (() => {
  const fromEnv = process.env.SNS_SMS_REGION;
  return fromEnv && isSmsRegion(fromEnv) ? fromEnv : "eu-central-1";
})();
