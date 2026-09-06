import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { whatsappAccount } from "@retransmit/db/schema/whatsapp";
import { normalizePhone } from "@retransmit/sms/phone";
import { and, eq } from "drizzle-orm";

import { decryptSecret, encryptSecret } from "./crypto";
import {
  exchangeCode,
  extendUserToken,
  fetchPhoneNumber,
  generatePin,
  listPhoneNumbers,
  registerPhoneNumber,
  requestBusinessAppSync,
  subscribeApp,
  unsubscribeApp,
} from "./meta-signup";
import type { MetaPhoneNumber } from "./meta-signup";
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
  /**
   * Absent when the dialog ended with the WhatsApp Business app path, which
   * only reports the WABA; the number is then looked up on it.
   */
  phoneNumberId?: string | null;
  /** True when the customer connected the number they use in the WhatsApp Business app. */
  businessApp?: boolean;
}

/**
 * Finds the number a Business app onboarding connected. Meta flags it with
 * `is_on_biz_app`; when the WABA has exactly one number that is it.
 */
async function findBusinessAppNumber(
  wabaId: string,
  token: string,
): Promise<MetaPhoneNumber & { id: string }> {
  const numbers = await listPhoneNumbers(wabaId, token);
  const onApp = numbers.filter((entry) => entry.isOnBusinessApp);
  const candidates = onApp.length > 0 ? onApp : numbers;
  if (candidates.length === 0) {
    throw new WhatsappAccountError(
      "not_found",
      "Meta did not attach a phone number to your WhatsApp Business Account. Finish the steps in the WhatsApp Business app, then try again.",
    );
  }
  if (candidates.length > 1) {
    throw new WhatsappAccountError(
      "ambiguous",
      "Your WhatsApp Business Account has several numbers; connect the one from the WhatsApp Business app on its own.",
    );
  }
  return candidates[0]!;
}

/**
 * Asks Meta to stream the Business app's contacts and message history to our
 * webhook. Meta requires the request within 24 hours of onboarding, or the
 * business has to go through the dialog again. History can be switched off
 * in the app; that is the business's choice, not an error worth showing.
 */
async function startBusinessAppSync(phoneNumberId: string, token: string): Promise<string | null> {
  const errors: string[] = [];
  for (const syncType of ["smb_app_state_sync", "history"] as const) {
    try {
      await requestBusinessAppSync(phoneNumberId, token, syncType);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (syncType === "history" && message.includes("2593109")) continue;
      errors.push(message);
    }
  }
  return errors.length > 0 ? errors.join("; ") : null;
}

/**
 * Completes Embedded Signup for one number: exchanges the code, subscribes
 * our app to the WABA, registers the number for Cloud API sending and stores
 * the (encrypted) token. Reconnecting a number the same organization already
 * has refreshes its token instead of creating a duplicate.
 *
 * A number from the WhatsApp Business app path is already registered by the
 * app, so registration is skipped and the app's data sync is requested
 * instead. The business keeps using the app alongside the API.
 */
export async function connectAccount(input: ConnectInput): Promise<WhatsappAccountRow> {
  const token = await exchangeCode(input.code);

  let phoneNumberId = input.phoneNumberId ?? null;
  let details: MetaPhoneNumber;
  if (phoneNumberId) {
    details = await fetchPhoneNumber(phoneNumberId, token);
  } else {
    const found = await findBusinessAppNumber(input.wabaId, token);
    phoneNumberId = found.id;
    details = found;
  }
  const businessApp = input.businessApp === true || details.isOnBusinessApp;

  const [existing] = await db
    .select()
    .from(whatsappAccount)
    .where(and(eq(whatsappAccount.provider, "meta"), eq(whatsappAccount.phoneNumberId, phoneNumberId)));
  if (existing && existing.organizationId !== input.organizationId) {
    throw new WhatsappAccountError(
      "conflict",
      "This WhatsApp number is already connected to another Retransmit organization",
    );
  }

  await subscribeApp(input.wabaId, token);

  let pin: string | null = null;
  let error: string | null = null;
  if (businessApp) {
    error = await startBusinessAppSync(phoneNumberId, token);
  } else {
    pin = existing?.pin ? decryptSecret(existing.pin) : generatePin();
    try {
      await registerPhoneNumber(phoneNumberId, token, pin);
    } catch (cause) {
      // A number can still be pending SMS/voice verification when the dialog
      // closes; keep the account and let a later sync/reconnect register it.
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  const values = {
    organizationId: input.organizationId,
    userId: input.userId,
    provider: "meta",
    source: businessApp ? ("business_app" as const) : ("embedded_signup" as const),
    wabaId: input.wabaId,
    phoneNumberId,
    phoneNumber: toE164(details.displayPhoneNumber),
    verifiedName: details.verifiedName,
    qualityRating: details.qualityRating,
    accessToken: encryptSecret(token),
    pin: pin ? encryptSecret(pin) : null,
    status: "active" as const,
    error,
    lastSyncedAt: new Date(),
  };

  const [row] = existing
    ? await db.update(whatsappAccount).set(values).where(eq(whatsappAccount.id, existing.id)).returning()
    : await db
        .insert(whatsappAccount)
        .values({ id: createId("wab"), ...values })
        .returning();
  if (!row) throw new Error("Could not store the WhatsApp account");
  return row;
}

export interface SandboxConfig {
  phoneNumberId: string;
  wabaId: string;
  /** Whether `WHATSAPP_META_TEST_ACCESS_TOKEN` is set, so the form can leave the token blank. */
  hasAccessToken: boolean;
}

/**
 * Meta's sandbox number for this app, from `WHATSAPP_META_TEST_PHONE_NUMBER_ID`
 * and `WHATSAPP_META_TEST_WABA_ID` (App Dashboard → WhatsApp → API Setup).
 * Null when unset, which hides the sandbox connect control in the dashboard.
 */
export function sandboxConfig(): SandboxConfig | null {
  const phoneNumberId = process.env.WHATSAPP_META_TEST_PHONE_NUMBER_ID;
  const wabaId = process.env.WHATSAPP_META_TEST_WABA_ID;
  if (!phoneNumberId || !wabaId) return null;
  return {
    phoneNumberId,
    wabaId,
    hasAccessToken: Boolean(process.env.WHATSAPP_META_TEST_ACCESS_TOKEN),
  };
}

export interface ConnectSandboxInput {
  organizationId: string;
  userId: string;
  /** Falls back to `WHATSAPP_META_TEST_ACCESS_TOKEN` when empty. */
  accessToken?: string | null;
}

/**
 * Connects Meta's sandbox number as a regular account so the normal send
 * path (API, queue, templates, webhooks) can be exercised before the app has
 * a customer number. Embedded Signup cannot reach it: the test WABA belongs
 * to our app, not to a business portfolio. Meta pre-registers test numbers,
 * so there is no PIN step. The token is whatever the caller pastes, usually
 * the 24 hour one from API Setup; it is exchanged for a 60 day one before
 * being stored. Connecting again with a fresh token refreshes the stored one.
 */
export async function connectSandboxAccount(input: ConnectSandboxInput): Promise<WhatsappAccountRow> {
  const config = sandboxConfig();
  if (!config) throw new Error("WHATSAPP_META_TEST_PHONE_NUMBER_ID and WHATSAPP_META_TEST_WABA_ID are not set");
  const pasted = input.accessToken?.trim() || process.env.WHATSAPP_META_TEST_ACCESS_TOKEN;
  if (!pasted) throw new Error("Paste an access token from Meta's API Setup page");

  const [existing] = await db
    .select()
    .from(whatsappAccount)
    .where(
      and(eq(whatsappAccount.provider, "meta"), eq(whatsappAccount.phoneNumberId, config.phoneNumberId)),
    );
  if (existing && existing.organizationId !== input.organizationId) {
    throw new WhatsappAccountError(
      "conflict",
      "The sandbox number is already connected to another Retransmit organization",
    );
  }

  // Also validates the token: an expired one fails here with Meta's message.
  const details = await fetchPhoneNumber(config.phoneNumberId, pasted);
  const { token } = await extendUserToken(pasted);
  await subscribeApp(config.wabaId, token);

  const values = {
    organizationId: input.organizationId,
    userId: input.userId,
    provider: "meta",
    wabaId: config.wabaId,
    phoneNumberId: config.phoneNumberId,
    phoneNumber: toE164(details.displayPhoneNumber),
    verifiedName: details.verifiedName,
    qualityRating: details.qualityRating,
    accessToken: encryptSecret(token),
    pin: null,
    status: "active" as const,
    error: null,
    lastSyncedAt: new Date(),
  };

  const [row] = existing
    ? await db.update(whatsappAccount).set(values).where(eq(whatsappAccount.id, existing.id)).returning()
    : await db
        .insert(whatsappAccount)
        .values({ id: createId("wab"), source: "sandbox", ...values })
        .returning();
  if (!row) throw new Error("Could not store the sandbox account");
  return row;
}

/**
 * Refreshes name and quality from Meta. Retries whatever failed at connect
 * time: registration for numbers we registered, the Business app data sync
 * for numbers from the WhatsApp Business app. A Business app number that
 * Meta no longer reports as on the app was disconnected from the app side.
 */
export async function syncAccount(row: WhatsappAccountRow): Promise<WhatsappAccountRow> {
  const token = decryptSecret(row.accessToken);
  let error: string | null = null;
  if (row.error && row.source === "business_app" && row.status === "active") {
    error = await startBusinessAppSync(row.phoneNumberId, token);
  } else if (row.error && row.pin) {
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
      ...(row.source === "business_app" && row.status === "active" && !details.isOnBusinessApp
        ? { status: "disconnected" as const }
        : {}),
      error,
      lastSyncedAt: new Date(),
    })
    .where(eq(whatsappAccount.id, row.id))
    .returning();
  return updated ?? row;
}

/**
 * Marks a number disconnected after Meta's `account_update` webhook says the
 * business unlinked it, e.g. from the WhatsApp Business app (Settings →
 * Business Platform → Disconnect). The row stays so the dashboard can show
 * what happened and message history keeps its account. Returns false when
 * no active account matches.
 */
export async function markDisconnected(
  provider: string,
  phoneNumber: string,
  reason: string | null,
): Promise<boolean> {
  const normalized =
    normalizePhone(`+${phoneNumber.replace(/^\+/, "")}`) ?? `+${phoneNumber.replace(/\D/g, "")}`;
  const updated = await db
    .update(whatsappAccount)
    .set({
      status: "disconnected",
      error: reason ? `Disconnected by the business: ${reason}` : "Disconnected by the business",
    })
    .where(
      and(
        eq(whatsappAccount.provider, provider),
        eq(whatsappAccount.phoneNumber, normalized),
        eq(whatsappAccount.status, "active"),
      ),
    )
    .returning({ id: whatsappAccount.id });
  return updated.length > 0;
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
