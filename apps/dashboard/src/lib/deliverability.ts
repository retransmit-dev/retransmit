/**
 * Labels for the bounce reasons and mailbox providers the API returns.
 * Mirrors BOUNCE_REASONS and MAILBOX_PROVIDERS in @retransmit/db (kept local
 * so the schema package stays out of the client bundle).
 */

/**
 * Where the problem lies. This is the distinction worth showing: a bounce
 * blamed on the sender is something we can fix, and does not mean the
 * recipient's address is bad.
 */
export type BounceFault = "recipient" | "sender" | "message" | "unknown";

export const BOUNCE_REASON_LABELS: Record<
  string,
  { label: string; fault: BounceFault; hint: string }
> = {
  mailbox_not_found: {
    label: "Mailbox not found",
    fault: "recipient",
    hint: "No account with this address. The address was added to your suppression list.",
  },
  mailbox_full: {
    label: "Mailbox full",
    fault: "recipient",
    hint: "The mailbox is over quota. This usually clears on its own.",
  },
  mailbox_inactive: {
    label: "Account inactive",
    fault: "recipient",
    hint: "The account is disabled or no longer in use.",
  },
  spam_block: {
    label: "Filtered as spam",
    fault: "sender",
    hint: "The receiving server rejected the content, not the address. Check the subject, links and text-to-image ratio.",
  },
  reputation_block: {
    label: "Sender blocked",
    fault: "sender",
    hint: "The sending IP or domain is blocked or on a blocklist. Warm up volume slowly and check your blocklist status.",
  },
  authentication_failure: {
    label: "Authentication failed",
    fault: "sender",
    hint: "SPF, DKIM or DMARC did not pass at the receiver. Check the domain's DNS records.",
  },
  rate_limited: {
    label: "Rate limited",
    fault: "sender",
    hint: "The receiving server is throttling this sender. Sending more slowly usually clears it.",
  },
  message_too_large: {
    label: "Message too large",
    fault: "message",
    hint: "The message exceeded the receiver's size limit. Link to large attachments instead.",
  },
  content_rejected: {
    label: "Content rejected",
    fault: "message",
    hint: "An attachment or the body was refused, often by a virus scanner or a banned file type.",
  },
  policy_block: {
    label: "Blocked by a rule",
    fault: "recipient",
    hint: "A rule on the recipient's side refused the message, such as accepting internal mail only.",
  },
  dns_failure: {
    label: "Domain unreachable",
    fault: "recipient",
    hint: "The domain publishes no reachable mail server.",
  },
  provider_suppressed: {
    label: "Provider suppressed",
    fault: "recipient",
    hint: "The address is on the upstream provider's own suppression list from an earlier bounce.",
  },
  unknown: {
    label: "Refused",
    fault: "unknown",
    hint: "The receiving server gave no reason we recognise. The raw response is shown below.",
  },
};

export const MAILBOX_PROVIDER_LABELS: Record<string, string> = {
  microsoft365: "Microsoft 365",
  outlook_consumer: "Outlook.com",
  google_workspace: "Google Workspace",
  gmail: "Gmail",
  yahoo: "Yahoo / AOL",
  apple: "iCloud Mail",
  proton: "Proton Mail",
  zoho: "Zoho Mail",
  fastmail: "Fastmail",
  mimecast: "Mimecast",
  proofpoint: "Proofpoint",
  barracuda: "Barracuda",
  ovh: "OVH",
  ionos: "IONOS",
  other: "Other / self-hosted",
  none: "No mail server",
};

export function providerLabel(provider: string): string {
  return MAILBOX_PROVIDER_LABELS[provider] ?? provider;
}

export function bounceReasonLabel(reason: string): string {
  return BOUNCE_REASON_LABELS[reason]?.label ?? reason;
}
