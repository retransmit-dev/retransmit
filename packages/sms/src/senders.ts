import { db } from "@retransmit/db";
import { smsSender } from "@retransmit/db/schema/sms";
import { and, asc, eq } from "drizzle-orm";

import type { SmsRegion } from "./regions";
import { isSmsRegion } from "./regions";

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
 *
 * Resolving also decides the region, because on AWS the two are the same
 * fact: an origination identity only exists in the region it was registered
 * in, so picking the name picks where the message has to be sent from.
 */

export interface ResolvedSender {
  /** Approved compliance program backing this origination identity. */
  program: Awaited<ReturnType<typeof approvedSenders>>[number];
  /** Approved sender identity handed to the provider. */
  from: string | null;
  /**
   * Region the sender id is registered in.
   */
  region: SmsRegion | null;
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
  // no match and reject the send.
  if (!country) return false;
  return row.countries.includes(country.toUpperCase());
}

/**
 * The row's region, or null if it holds a value this build no longer knows.
 * A retired region returns null and the provider refuses an unattributed AWS
 * send rather than silently selecting another region.
 */
function regionOf(row: { region: string }): SmsRegion | null {
  return isSmsRegion(row.region) ? row.region : null;
}

/**
 * Decides the sender id for one send.
 *
 * - `requested` given: it must be an approved sender id of this organization
 *   that covers the destination country, otherwise the send is rejected. A
 *   caller who names a sender gets it or an error, never a silent swap — the
 *   same contract `selectProvider` uses for a pinned provider.
 * - `requested` omitted: the oldest approved sender id covering the
 *   destination. Hosted sends never fall back to a shared platform identity:
 *   every message must belong to one reviewed program.
 */
export async function resolveSender(
  organizationId: string | null,
  country: string | null,
  requested?: string | null,
): Promise<ResolvedSender> {
  if (!organizationId) {
    throw new SenderNotAllowedError("SMS requires an organization with an approved sender program");
  }

  const senders = await approvedSenders(organizationId);

  if (requested) {
    const wanted = requested.trim();
    const match = senders.find(
      (row) => row.senderId.toLowerCase() === wanted.toLowerCase() && covers(row, country),
    );
    if (match) return { from: match.senderId, region: regionOf(match), program: match };

    const known = senders.find((row) => row.senderId.toLowerCase() === wanted.toLowerCase());
    throw new SenderNotAllowedError(
      known
        ? `Sender id "${wanted}" is not approved for ${country ?? "this destination"}`
        : `Sender id "${wanted}" is not approved for your organization. Request it under SMS > Programs.`,
    );
  }

  const match = senders.find((row) => covers(row, country));
  if (!match) {
    throw new SenderNotAllowedError(
      `No approved SMS program covers ${country ?? "this destination"}. Request one under SMS > Programs.`,
    );
  }
  return { from: match.senderId, region: regionOf(match), program: match };
}
