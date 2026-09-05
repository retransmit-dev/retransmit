/**
 * SES regions a customer can verify a domain into. Identities, MAIL FROM
 * domains and sending quotas are strictly regional: an email is sent from the
 * region its domain was verified in, so the choice mostly decides where the
 * outbound traffic originates. Kept free of AWS SDK imports so it can be
 * served to the dashboard as-is.
 */
export const SES_REGIONS = [
  { id: "eu-central-1", name: "Europe", location: "Frankfurt", flag: "🇩🇪" },
  { id: "us-east-1", name: "United States", location: "N. Virginia", flag: "🇺🇸" },
  { id: "ap-southeast-1", name: "Asia Pacific", location: "Singapore", flag: "🇸🇬" },
  { id: "af-south-1", name: "Africa", location: "Cape Town", flag: "🇿🇦" },
] as const;

export type SesRegion = (typeof SES_REGIONS)[number]["id"];

export const SES_REGION_IDS = SES_REGIONS.map((region) => region.id) as [SesRegion, ...SesRegion[]];

export function isSesRegion(value: string): value is SesRegion {
  return (SES_REGION_IDS as string[]).includes(value);
}

/**
 * Region Retransmit's own identities live in and the one pre-selected when a
 * customer adds a domain. `AWS_REGION` wins; see the SES notes in the repo
 * memory before changing the fallback.
 */
export const DEFAULT_SES_REGION: SesRegion = (() => {
  const fromEnv = process.env.AWS_REGION;
  return fromEnv && isSesRegion(fromEnv) ? fromEnv : "us-east-1";
})();
