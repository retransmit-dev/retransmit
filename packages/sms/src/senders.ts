import { db } from "@retransmit/db";
import { smsSender } from "@retransmit/db/schema/sms";
import { and, asc, eq } from "drizzle-orm";

/**
 * Resolving what goes in the `from` field of a send.
 *
 * Two jobs, and the second is the reason this exists: picking a default
 * sender id for an organization, and making sure a caller-supplied one is a
 * name that organization is actually allowed to use. `from` used to go
 * straight through to the carrier, which meant any customer could put any
 * brand on a handset.
 *
 * Approval is per country because that is how carriers grant it: a sender id
 * cleared for Cameroon says nothing about Nigeria. A row only counts for a
 * destination if its `countries` list contains that destination.
 */

export interface ResolvedSender {
  /** The string to hand the provider, or null to use the provider default. */
  from: string | null;
}

export class SenderNotAllowedError extends Error {
  readonly code = "sender_not_allowed";
  constructor(message: string) {
    super(message);
    this.name = "SenderNotAllowedError";
  }
}

/** Approved sender ids for an organization, oldest first. */
async function approvedSenders(organizationId: string) {
  return await db
    .select()
    .from(smsSender)
    .where(and(eq(smsSender.organizationId, organizationId), eq(smsSender.status, "approved")))
    .orderBy(asc(smsSender.createdAt));
}

function covers(row: { countries: string[] }, country: string | null): boolean {
  // An undetected country cannot be checked against an approval, so only a
  // sender id approved everywhere we know about would qualify — treat it as
  // no match and let the provider default apply.
  if (!country) return false;
  return row.countries.includes(country.toUpperCase());
}

/**
 * Decides the sender id for one send.
 *
 * - `requested` given: it must be an approved sender id of this organization
 *   that covers the destination country, otherwise the send is rejected. A
 *   caller who names a sender gets it or an error, never a silent swap — the
 *   same contract `selectProvider` uses for a pinned provider.
 * - `requested` omitted: the oldest approved sender id covering the
 *   destination, or null so the provider falls back to its configured
 *   default (`SNS_SMS_SENDER_ID`, the MTN sender address, ...).
 *
 * Organization-less rows (personal API keys that predate organizations)
 * cannot be checked against an allowlist, so they keep the old behaviour and
 * pass `from` through untouched.
 */
export async function resolveSender(
  organizationId: string | null,
  country: string | null,
  requested?: string | null,
): Promise<ResolvedSender> {
  if (!organizationId) return { from: requested ?? null };

  const senders = await approvedSenders(organizationId);

  if (requested) {
    const wanted = requested.trim();
    const match = senders.find(
      (row) => row.senderId.toLowerCase() === wanted.toLowerCase() && covers(row, country),
    );
    if (match) return { from: match.senderId };

    const known = senders.find((row) => row.senderId.toLowerCase() === wanted.toLowerCase());
    throw new SenderNotAllowedError(
      known
        ? `Sender id "${wanted}" is not approved for ${country ?? "this destination"}`
        : `Sender id "${wanted}" is not approved for your organization. Request it under SMS > Sender IDs.`,
    );
  }

  const match = senders.find((row) => covers(row, country));
  return { from: match?.senderId ?? null };
}
