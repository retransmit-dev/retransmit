import type { BounceReason } from "@retransmit/db/schema/email";

/** The parts of an SES `Bounce` event we classify from. */
export interface SesBounce {
  bounceType?: string;
  bounceSubType?: string;
  bouncedRecipients?: {
    emailAddress?: string;
    action?: string;
    status?: string;
    diagnosticCode?: string;
  }[];
}

export interface BounceClassification {
  reason: BounceReason;
  /** One sentence for the dashboard, plus the raw diagnostic code. */
  message: string;
  /**
   * Whether the recipient belongs on the suppression list. True only when the
   * *address* is the problem. A spam filter or an IP block says nothing about
   * whether the mailbox exists, and suppressing on one would quietly burn a
   * good address every time our reputation dips.
   */
  suppress: boolean;
}

/** The sentence shown for each reason. */
const REASON_MESSAGE: Record<BounceReason, string> = {
  mailbox_not_found: "The recipient's mailbox does not exist.",
  mailbox_full: "The recipient's mailbox is full.",
  mailbox_inactive: "The recipient's account is disabled or no longer in use.",
  spam_block: "The receiving server filtered this message as spam.",
  reputation_block: "The receiving server blocked the sending IP or domain.",
  authentication_failure:
    "The receiving server rejected this message because SPF, DKIM or DMARC did not pass.",
  rate_limited: "The receiving server is throttling this sender and refused the message for now.",
  message_too_large: "The message was larger than the receiving server accepts.",
  content_rejected: "The receiving server refused the message content or an attachment.",
  policy_block: "A rule on the recipient's side refused the message.",
  dns_failure: "The recipient's domain has no reachable mail server.",
  provider_suppressed: "The address is on the sending account's provider-level suppression list.",
  unknown: "The receiving server refused the message.",
};

/**
 * Reasons that are about us or about this one message rather than about the
 * address. A permanent bounce for one of these must not suppress: the
 * mailbox is fine and will accept mail again once our reputation recovers or
 * the message changes.
 *
 * Everything else still suppresses, including `unknown` and `policy_block`,
 * because a bounce that recurs for the same address is what gets a sending
 * account suspended. We only narrow suppression where the diagnostic code is
 * positive evidence the recipient is not at fault.
 */
const NON_SUPPRESSING_REASONS = new Set<BounceReason>([
  "spam_block",
  "reputation_block",
  "authentication_failure",
  "rate_limited",
  "message_too_large",
  "content_rejected",
  "mailbox_full",
]);

/**
 * Diagnostic-code patterns, most specific first. Receiving servers phrase
 * rejections freely, so these match on the enhanced status code where there
 * is one and on wording where there is not.
 *
 * The Microsoft codes matter most to us: Exchange Online is the common
 * mailbox behind a small business's custom domain, and unlike a consumer
 * provider it reports nothing except through these rejections.
 */
const RULES: { pattern: RegExp; reason: BounceReason }[] = [
  // --- Microsoft 365 / Exchange Online Protection ---
  // S3140/S3150 accompany "Message rejected as spam by Content Filtering".
  { pattern: /\bS(?:3115|3140|3150)\b/i, reason: "spam_block" },
  // 5.7.606-5.7.614: "Access denied, banned sending IP".
  { pattern: /\b5\.7\.6(?:0[6-9]|1[0-4])\b/, reason: "reputation_block" },
  { pattern: /banned sending ip/i, reason: "reputation_block" },
  // 5.7.509: "does not pass DMARC verification". 5.7.515/5.7.516: SPF/DKIM.
  { pattern: /\b5\.7\.5(?:09|15|16)\b/, reason: "authentication_failure" },
  // 5.7.511: "Access denied, banned sender".
  { pattern: /\b5\.7\.51[01]\b/, reason: "reputation_block" },
  // RESOLVER.ADR.RecipientNotFound, and 5.1.10 / 5.4.1 from Exchange.
  { pattern: /recipientnotfound|\b5\.1\.10\b/i, reason: "mailbox_not_found" },
  {
    pattern: /\b5\.4\.1\b.*(?:recipient address rejected|relay access denied)/i,
    reason: "mailbox_not_found",
  },
  { pattern: /\b4\.7\.5(?:0[0-9]|1[01])\b/, reason: "rate_limited" },

  // --- Domain does not resolve ---
  // Ahead of the mailbox rules: "the domain does not exist" must not be read
  // as "the mailbox does not exist".
  {
    pattern: /\b5\.(?:1\.2|4\.4)\b|domain\b[^.]{0,30}(?:not found|does not exist)|no mx record|unrouteable address|host or domain name not found/i,
    reason: "dns_failure",
  },

  // --- Google (Gmail and Workspace) ---
  { pattern: /\b5\.7\.26\b/, reason: "authentication_failure" },
  {
    pattern: /unsolicited mail|this message is suspicious|likely unsolicited/i,
    reason: "spam_block",
  },
  { pattern: /\b4\.7\.28\b|unusual rate of|traffic from your sending/i, reason: "rate_limited" },
  {
    pattern: /does not exist|no such user|user unknown|unknown user|recipient not found|address not found|invalid recipient|no mailbox/i,
    reason: "mailbox_not_found",
  },
  {
    // The bare 5.2.1 code is handled below; this is for servers that say it
    // in words instead.
    pattern: /account (?:has been )?(?:disabled|suspended|closed)|account is inactive/i,
    reason: "mailbox_inactive",
  },

  // --- Standard enhanced status codes (RFC 3463), for terse servers ---
  // Checked after the provider wording above, which is more specific, but
  // before the generic keyword rules, which are guesses by comparison.
  { pattern: /\b5\.1\.[16]\b/, reason: "mailbox_not_found" },
  { pattern: /\b5\.2\.1\b/, reason: "mailbox_inactive" },

  // --- Yahoo and generic policy rejections ---
  { pattern: /\b5\.7\.9\b|not accepted for policy reasons|policy reasons/i, reason: "spam_block" },

  // --- Blocklists and reputation, any provider ---
  {
    pattern: /spamhaus|barracudacentral|\bdnsbl\b|\brbl\b|blocklist|blacklist|listed (?:in|on) /i,
    reason: "reputation_block",
  },
  {
    pattern: /(?:ip|host) .{0,40}\b(?:blocked|banned|denied)|poor reputation|bad reputation|sender reputation/i,
    reason: "reputation_block",
  },

  // --- Spam wording, any provider ---
  {
    pattern: /\bspam\b|\bjunk\b|\bbulk mail\b|message content rejected as spam|spam filter/i,
    reason: "spam_block",
  },

  // --- Authentication, any provider ---
  {
    pattern: /\bdmarc\b|\bdkim\b|\bspf\b.{0,30}(?:fail|not|reject)|unauthenticated/i,
    reason: "authentication_failure",
  },

  // --- Mailbox state ---
  {
    pattern: /\b(?:4|5)\.2\.2\b|mailbox (?:is )?full|over quota|quota exceeded|insufficient storage/i,
    reason: "mailbox_full",
  },

  // --- Message shape ---
  {
    pattern: /\b5\.3\.4\b|message (?:is )?too (?:large|big)|size limit exceeded|exceeds (?:size|maximum)/i,
    reason: "message_too_large",
  },
  {
    pattern: /\bvirus\b|malware|attachment .{0,20}(?:reject|not allowed|banned)|file type .{0,20}not allowed/i,
    reason: "content_rejected",
  },

  // --- Rate limiting ---
  {
    pattern: /\b4\.7\.[01]\b|too many (?:messages|connections)|rate limit|try again later|throttl/i,
    reason: "rate_limited",
  },

  // --- Recipient-side rules ---
  {
    pattern: /\b5\.7\.1\b|access denied|not authorized|rejected by (?:recipient|administrator)|does not accept mail from/i,
    reason: "policy_block",
  },
];

/** SES's own `bounceSubType`, used when the diagnostic code told us nothing. */
const SUB_TYPE_REASON: Record<string, BounceReason> = {
  NoEmail: "mailbox_not_found",
  Suppressed: "provider_suppressed",
  OnAccountSuppressionList: "provider_suppressed",
  MailboxFull: "mailbox_full",
  MessageTooLarge: "message_too_large",
  ContentRejected: "content_rejected",
  AttachmentRejected: "content_rejected",
};

/** Keeps `error` readable when a server returns a wall of text. */
function truncate(value: string, max = 240): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max - 1)}…` : collapsed;
}

/**
 * Works out why a bounce happened, from the SMTP diagnostic code first and
 * SES's own classification second.
 *
 * A `Permanent` bounce is not on its own a reason to suppress: Exchange
 * Online and Gmail both return 5.x.x when they refuse a message as spam, and
 * the mailbox behind it is usually fine. See `NON_SUPPRESSING_REASONS` for
 * where `suppress` departs from "every permanent bounce".
 */
export function classifyBounce(bounce: SesBounce | undefined): BounceClassification {
  const permanent = bounce?.bounceType === "Permanent";
  const diagnostics = (bounce?.bouncedRecipients ?? [])
    .map((recipient) => [recipient.status, recipient.diagnosticCode].filter(Boolean).join(" "))
    .filter(Boolean);
  const haystack = diagnostics.join(" | ");

  let reason: BounceReason | undefined;
  if (haystack) {
    reason = RULES.find((rule) => rule.pattern.test(haystack))?.reason;
  }
  reason ??= bounce?.bounceSubType ? SUB_TYPE_REASON[bounce.bounceSubType] : undefined;
  if (!reason) {
    // Nothing recognisable. A transient bounce is the receiver asking us to
    // come back later, which is closer to throttling than to a hard failure.
    reason = bounce?.bounceType === "Transient" ? "rate_limited" : "unknown";
  }

  // A transient bounce never suppresses, whatever the wording suggested.
  const suppress = permanent && !NON_SUPPRESSING_REASONS.has(reason);

  const detail = diagnostics[0];
  const message = detail
    ? `${REASON_MESSAGE[reason]} (${truncate(detail)})`
    : REASON_MESSAGE[reason];

  return { reason, message, suppress };
}
