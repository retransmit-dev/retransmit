import { resolveMx } from "node:dns/promises";

import { db } from "@retransmit/db";
import { mailboxDomain } from "@retransmit/db/schema/email";
import type { MailboxProvider } from "@retransmit/db/schema/email";
import { eq } from "drizzle-orm";

import { extractEmailDomain } from "./address";

/** How long a cached MX answer is trusted before we look the domain up again. */
export const MAILBOX_DOMAIN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** A resolver that hangs must not hold up a send job. */
const LOOKUP_TIMEOUT_MS = 3_000;

/**
 * MX hostname suffixes, most specific first. A domain's lowest-preference MX
 * host names the provider: `acme-roofing.com` pointing at
 * `acme-roofing-com.mail.protection.outlook.com` is a Microsoft 365 tenant,
 * whatever the domain looks like.
 */
const MX_PATTERNS: { suffix: string; provider: MailboxProvider }[] = [
  // Consumer Outlook/Hotmail/Live mailboxes, which are a different filtering
  // stack (and a different feedback-loop story) from a business tenant.
  { suffix: ".olc.protection.outlook.com", provider: "outlook_consumer" },
  { suffix: ".mail.protection.outlook.com", provider: "microsoft365" },
  { suffix: ".protection.outlook.com", provider: "microsoft365" },
  { suffix: ".hotmail.com", provider: "outlook_consumer" },
  { suffix: ".aspmx.l.google.com", provider: "google_workspace" },
  { suffix: "aspmx.l.google.com", provider: "google_workspace" },
  { suffix: ".googlemail.com", provider: "google_workspace" },
  { suffix: ".psmtp.com", provider: "google_workspace" },
  { suffix: ".yahoodns.net", provider: "yahoo" },
  { suffix: ".mail.icloud.com", provider: "apple" },
  { suffix: ".icloud.com", provider: "apple" },
  { suffix: ".protonmail.ch", provider: "proton" },
  { suffix: ".proton.me", provider: "proton" },
  { suffix: ".zoho.com", provider: "zoho" },
  { suffix: ".zoho.eu", provider: "zoho" },
  { suffix: ".zohomail.com", provider: "zoho" },
  { suffix: ".messagingengine.com", provider: "fastmail" },
  { suffix: ".fastmail.com", provider: "fastmail" },
  // Security gateways. They usually sit in front of Microsoft 365 or
  // Google Workspace, but their filter is the one that decides delivery, so
  // they are worth counting separately.
  { suffix: ".mimecast.com", provider: "mimecast" },
  { suffix: ".mimecast.co.za", provider: "mimecast" },
  { suffix: ".pphosted.com", provider: "proofpoint" },
  { suffix: ".ppe-hosted.com", provider: "proofpoint" },
  { suffix: ".barracudanetworks.com", provider: "barracuda" },
  { suffix: ".ovh.net", provider: "ovh" },
  { suffix: ".mail.ovh.net", provider: "ovh" },
  { suffix: ".ionos.com", provider: "ionos" },
  { suffix: ".ionos.de", provider: "ionos" },
  { suffix: ".1and1.com", provider: "ionos" },
  { suffix: ".kundenserver.de", provider: "ionos" },
];

/**
 * Consumer domains whose provider we know without asking DNS, and which the
 * MX records alone would not tell apart from a hosted custom domain.
 */
const KNOWN_DOMAINS: Record<string, MailboxProvider> = {
  "gmail.com": "gmail",
  "googlemail.com": "gmail",
  "outlook.com": "outlook_consumer",
  "hotmail.com": "outlook_consumer",
  "hotmail.co.uk": "outlook_consumer",
  "hotmail.fr": "outlook_consumer",
  "live.com": "outlook_consumer",
  "msn.com": "outlook_consumer",
  "yahoo.com": "yahoo",
  "yahoo.co.uk": "yahoo",
  "yahoo.fr": "yahoo",
  "ymail.com": "yahoo",
  "aol.com": "yahoo",
  "icloud.com": "apple",
  "me.com": "apple",
  "mac.com": "apple",
  "protonmail.com": "proton",
  "proton.me": "proton",
};

/**
 * Maps MX hostnames to the provider behind them. Pure, so the mapping can be
 * tested without DNS. Hosts are expected lowest preference first; an empty
 * list means the domain cannot receive mail at all.
 */
export function providerFromMxHosts(hosts: string[]): MailboxProvider {
  if (hosts.length === 0) return "none";
  for (const host of hosts) {
    const normalized = host.toLowerCase().replace(/\.$/, "");
    const match = MX_PATTERNS.find((pattern) => normalized.endsWith(pattern.suffix));
    if (match) return match.provider;
  }
  return "other";
}

/** DNS errors that mean "this domain has no mail", as opposed to "ask again". */
const NO_MAIL_CODES = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

async function lookupMxHosts(domain: string): Promise<string[] | null> {
  const timeout = new Promise<null>((resolve) => {
    // Unref'd so a pending lookup never keeps the worker process alive.
    setTimeout(resolve, LOOKUP_TIMEOUT_MS, null).unref();
  });
  try {
    const records = await Promise.race([resolveMx(domain), timeout]);
    if (records === null) return null;
    return [...records]
      .sort((a, b) => a.priority - b.priority)
      .map((record) => record.exchange)
      .filter(Boolean);
  } catch (cause) {
    const code = (cause as NodeJS.ErrnoException).code ?? "";
    // A domain that does not resolve has no mailbox; a SERVFAIL or a timeout
    // is our resolver having a bad day, so leave it uncached and try later.
    return NO_MAIL_CODES.has(code) ? [] : null;
  }
}

/**
 * Who runs the mailbox for this address, from the MX records of its domain.
 * Answers are cached in `mailbox_domain` and shared across organizations, so
 * a domain costs one DNS lookup every `MAILBOX_DOMAIN_TTL_MS`.
 *
 * Returns null when the lookup failed, which is different from `"none"`: null
 * means we do not know, so the caller should leave the field unset rather
 * than record a domain as unreachable.
 */
export async function mailboxProviderFor(address: string): Promise<MailboxProvider | null> {
  const domain = extractEmailDomain(address);
  if (!domain) return null;

  const known = KNOWN_DOMAINS[domain];
  if (known) return known;

  const [cached] = await db
    .select()
    .from(mailboxDomain)
    .where(eq(mailboxDomain.domain, domain));
  if (cached && Date.now() - cached.checkedAt.getTime() < MAILBOX_DOMAIN_TTL_MS) {
    return cached.provider;
  }

  const hosts = await lookupMxHosts(domain);
  // Keep serving a stale answer rather than nothing when DNS is unavailable.
  if (hosts === null) return cached?.provider ?? null;

  const provider = providerFromMxHosts(hosts);
  await db
    .insert(mailboxDomain)
    .values({ domain, provider, mxHosts: hosts, checkedAt: new Date() })
    .onConflictDoUpdate({
      target: mailboxDomain.domain,
      set: { provider, mxHosts: hosts, checkedAt: new Date() },
    });
  return provider;
}
