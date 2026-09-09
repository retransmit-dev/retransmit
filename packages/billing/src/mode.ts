export const RETRANSMIT_MODES = ["cloud", "self-hosted"] as const;

export type RetransmitMode = (typeof RETRANSMIT_MODES)[number];

/**
 * The commercial boundary of a Retransmit deployment.
 *
 * This is deliberately explicit rather than inferred from STRIPE_SECRET_KEY:
 * a missing cloud secret must disable billing, not silently turn a hosted
 * deployment into an unrestricted self-hosted one.
 */
export function getRetransmitMode(): RetransmitMode {
  const mode = process.env.RETRANSMIT_MODE;
  if (mode === "cloud" || mode === "self-hosted") return mode;

  throw new Error(
    'RETRANSMIT_MODE must be set to either "cloud" or "self-hosted"',
  );
}

export function isCloudMode(): boolean {
  return getRetransmitMode() === "cloud";
}

export function isSelfHostedMode(): boolean {
  return getRetransmitMode() === "self-hosted";
}
