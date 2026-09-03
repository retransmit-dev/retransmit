import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { whatsappAccount } from "@retransmit/db/schema/whatsapp";
import { normalizePhone } from "@retransmit/sms/phone";
import { and, eq } from "drizzle-orm";

import { decryptSecret, encryptSecret } from "./crypto";
import {
  exchangeCode,
  fetchPhoneNumber,
  generatePin,
  registerPhoneNumber,
  subscribeApp,
  unsubscribeApp,
} from "./meta-signup";
import type { WhatsappSender } from "./provider";

export type WhatsappAccountRow = typeof whatsappAccount.$inferSelect;

/** Fields safe to hand to the dashboard (no token or PIN). */
export function publicAccount(row: WhatsappAccountRow) {
  const { accessToken: _token, pin: _pin, ...rest } = row;
  return rest;
}

export class WhatsappAccountError extends Error {
  constructor(
    readonly code: "not_found" | "conflict" | "ambiguous" | "disconnected",
    message: string,
  ) {
    super(message);
  }
}

/** Decrypted credentials for sending through a connected number. */
export function senderFor(row: WhatsappAccountRow): WhatsappSender {
  return { phoneNumberId: row.phoneNumberId, accessToken: decryptSecret(row.accessToken) };
}

/** Meta returns `+1 555-000-1234` style display numbers. */
function toE164(display: string): string {
  return normalizePhone(`+${display.replace(/^\+/, "")}`) ?? `+${display.replace(/\D/g, "")}`;
}

/**
 * Picks the connected number an API request sends from. `from` may be the
 * number in E.164 or an account id; without it the organization's only
 * active number is used.
 */
export async function resolveSenderAccount(
  organizationId: string,
  from?: string | null,
): Promise<WhatsappAccountRow> {
  const rows = await db
    .select()
    .from(whatsappAccount)
    .where(eq(whatsappAccount.organizationId, organizationId));
  const active = rows.filter((row) => row.status === "active");

  if (from) {
    const normalized = normalizePhone(from);
    const match = rows.find((row) => row.id === from || (normalized && row.phoneNumber === normalized));
    if (!match) {
      throw new WhatsappAccountError("not_found", `${from} is not a WhatsApp number connected to your organization`);
    }
    if (match.status !== "active") {
      throw new WhatsappAccountError("disconnected", `${match.phoneNumber} is disconnected; reconnect it in the dashboard`);
    }
    return match;
  }
  if (active.length === 0) {
    throw new WhatsappAccountError(
      "not_found",
      "No WhatsApp number is connected to your organization. Connect one in the dashboard under WhatsApp.",
    );
  }
  if (active.length > 1) {
    throw new WhatsappAccountError(
      "ambiguous",
      "Your organization has several WhatsApp numbers; pass `from` to choose one",
    );
  }
  return active[0]!;
}

export interface ConnectInput {
  organizationId: string;
  userId: string;
  /** Short lived code from the Embedded Signup dialog. */
  code: string;
  wabaId: string;
  phoneNumberId: string;
}

/**
 * Completes Embedded Signup for one number: exchanges the code, subscribes
 * our app to the WABA, registers the number for Cloud API sending and stores
 * the (encrypted) token. Reconnecting a number the same organization already
 * has refreshes its token instead of creating a duplicate.
 */
export async function connectAccount(input: ConnectInput): Promise<WhatsappAccountRow> {
  const [existing] = await db
    .select()
    .from(whatsappAccount)
    .where(
      and(eq(whatsappAccount.provider, "meta"), eq(whatsappAccount.phoneNumberId, input.phoneNumberId)),
    );
  if (existing && existing.organizationId !== input.organizationId) {
    throw new WhatsappAccountError(
      "conflict",
      "This WhatsApp number is already connected to another Retransmit organization",
    );
  }

  const token = await exchangeCode(input.code);
  await subscribeApp(input.wabaId, token);

  const pin = existing?.pin ? decryptSecret(existing.pin) : generatePin();
  let registrationError: string | null = null;
  try {
    await registerPhoneNumber(input.phoneNumberId, token, pin);
  } catch (cause) {
    // A number can still be pending SMS/voice verification when the dialog
    // closes; keep the account and let a later sync/reconnect register it.
    registrationError = cause instanceof Error ? cause.message : String(cause);
  }
  const details = await fetchPhoneNumber(input.phoneNumberId, token);

  const values = {
    organizationId: input.organizationId,
    userId: input.userId,
    provider: "meta",
    wabaId: input.wabaId,
    phoneNumberId: input.phoneNumberId,
    phoneNumber: toE164(details.displayPhoneNumber),
    verifiedName: details.verifiedName,
    qualityRating: details.qualityRating,
    accessToken: encryptSecret(token),
    pin: encryptSecret(pin),
    status: "active" as const,
    error: registrationError,
    lastSyncedAt: new Date(),
  };

  const [row] = existing
    ? await db.update(whatsappAccount).set(values).where(eq(whatsappAccount.id, existing.id)).returning()
    : await db
        .insert(whatsappAccount)
        .values({ id: createId("wab"), source: "embedded_signup", ...values })
        .returning();
  if (!row) throw new Error("Could not store the WhatsApp account");
  return row;
}

/** Refreshes name and quality from Meta and retries registration if it failed. */
export async function syncAccount(row: WhatsappAccountRow): Promise<WhatsappAccountRow> {
  const token = decryptSecret(row.accessToken);
  let error: string | null = null;
  if (row.error && row.pin) {
    try {
      await registerPhoneNumber(row.phoneNumberId, token, decryptSecret(row.pin));
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }
  const details = await fetchPhoneNumber(row.phoneNumberId, token);
  const [updated] = await db
    .update(whatsappAccount)
    .set({
      phoneNumber: toE164(details.displayPhoneNumber),
      verifiedName: details.verifiedName,
      qualityRating: details.qualityRating,
      error,
      lastSyncedAt: new Date(),
    })
    .where(eq(whatsappAccount.id, row.id))
    .returning();
  return updated ?? row;
}

/**
 * Removes a number. The app is unsubscribed from the WABA only when no
 * other connected number shares it; Meta errors here are ignored because
 * the customer may already have revoked our access.
 */
export async function disconnectAccount(row: WhatsappAccountRow): Promise<void> {
  const siblings = await db
    .select({ id: whatsappAccount.id })
    .from(whatsappAccount)
    .where(and(eq(whatsappAccount.provider, row.provider), eq(whatsappAccount.wabaId, row.wabaId)));
  if (siblings.length <= 1) {
    await unsubscribeApp(row.wabaId, decryptSecret(row.accessToken)).catch((cause) => {
      console.warn(`[whatsapp] could not unsubscribe WABA ${row.wabaId}:`, cause);
    });
  }
  await db.delete(whatsappAccount).where(eq(whatsappAccount.id, row.id));
}
