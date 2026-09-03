import { createHmac, timingSafeEqual } from "node:crypto";

import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import type { WebhookEventType } from "@retransmit/db/schema/email";
import { whatsappEvent, whatsappInbound, whatsappMessage } from "@retransmit/db/schema/whatsapp";
import type { WhatsappStatus } from "@retransmit/db/schema/whatsapp";
import { dispatchWebhookEvent } from "@retransmit/email/webhooks";
import { normalizePhone } from "@retransmit/sms/phone";
import { and, desc, eq } from "drizzle-orm";
import z from "zod";

interface MappedStatus {
  status: WhatsappStatus;
  webhook: WebhookEventType;
}

/** Notifications can arrive out of order; a status only moves forward. */
const STATUS_RANK: Record<WhatsappStatus, number> = {
  queued: 0,
  sent: 10,
  delivered: 30,
  read: 40,
  failed: 80,
};

export function webhookPayload(row: typeof whatsappMessage.$inferSelect) {
  return {
    messageId: row.id,
    to: row.to,
    country: row.country,
    type: row.type,
    provider: row.provider,
    providerMessageId: row.providerMessageId,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Moves one message forward, records the raw notification as an event and
 * fans it out to the user's webhooks. Rows that are not found or already at
 * or past `mapped.status` are left alone (`applied: false`).
 */
async function applyDeliveryStatus(
  providerMessageId: string,
  mapped: MappedStatus,
  raw: Record<string, unknown>,
  error?: string,
): Promise<{ applied: boolean }> {
  const [row] = await db
    .select()
    .from(whatsappMessage)
    .where(eq(whatsappMessage.providerMessageId, providerMessageId));
  if (!row) return { applied: false };
  if (STATUS_RANK[mapped.status] <= STATUS_RANK[row.status]) return { applied: false };

  await db
    .update(whatsappMessage)
    .set({ status: mapped.status, lastEventAt: new Date(), ...(error ? { error } : {}) })
    .where(eq(whatsappMessage.id, row.id));
  await db.insert(whatsappEvent).values({
    id: createId("wae"),
    messageId: row.id,
    type: mapped.webhook,
    data: raw,
  });
  await dispatchWebhookEvent(row.userId, mapped.webhook, {
    ...webhookPayload(row),
    ...(error ? { data: { message: error } } : {}),
  });
  return { applied: true };
}

// ---------------------------------------------------------------------------
// Meta Cloud API webhooks

/**
 * Meta signs every webhook POST: `X-Hub-Signature-256: sha256=<hmac>` over
 * the raw body with the app secret. Without WHATSAPP_META_APP_SECRET the
 * check is skipped (local development only — set it in production).
 */
export function verifyMetaSignature(rawBody: string, header: string | undefined): boolean {
  const secret = process.env.WHATSAPP_META_APP_SECRET;
  if (!secret) return true;
  const provided = header?.replace(/^sha256=/, "");
  if (!provided) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

const metaErrorSchema = z
  .object({
    code: z.number().optional(),
    title: z.string().optional(),
    message: z.string().optional(),
    error_data: z.object({ details: z.string().optional() }).loose().optional(),
  })
  .loose();

const metaStatusSchema = z
  .object({
    id: z.string().min(1),
    status: z.string().min(1),
    timestamp: z.string().optional(),
    recipient_id: z.string().optional(),
    errors: z.array(metaErrorSchema).optional(),
  })
  .loose();

const metaInboundSchema = z
  .object({
    id: z.string().min(1),
    from: z.string().min(1),
    timestamp: z.string().optional(),
    type: z.string().min(1),
    context: z.object({ from: z.string().optional(), id: z.string().optional() }).loose().optional(),
  })
  .loose();

const metaChangeSchema = z
  .object({
    field: z.string(),
    value: z
      .object({
        messaging_product: z.string().optional(),
        metadata: z
          .object({
            display_phone_number: z.string().optional(),
            phone_number_id: z.string().optional(),
          })
          .loose()
          .optional(),
        contacts: z
          .array(
            z
              .object({
                wa_id: z.string().optional(),
                profile: z.object({ name: z.string().optional() }).loose().optional(),
              })
              .loose(),
          )
          .optional(),
        statuses: z.array(metaStatusSchema).optional(),
        messages: z.array(metaInboundSchema).optional(),
      })
      .loose(),
  })
  .loose();

const metaWebhookSchema = z
  .object({
    object: z.string(),
    entry: z.array(z.object({ id: z.string().optional(), changes: z.array(metaChangeSchema) }).loose()),
  })
  .loose();

/** Meta message statuses → our status + webhook event. */
const META_STATUS_MAP: Record<string, MappedStatus> = {
  // `sent` is already recorded when the API accepts the message; it is listed
  // so a status notification that beats our own update is still harmless.
  sent: { status: "sent", webhook: "whatsapp.sent" },
  delivered: { status: "delivered", webhook: "whatsapp.delivered" },
  read: { status: "read", webhook: "whatsapp.read" },
  failed: { status: "failed", webhook: "whatsapp.failed" },
  // `warning` and `deleted` are informational; the row keeps its state.
};

function describeStatusErrors(errors: z.infer<typeof metaErrorSchema>[] | undefined): string {
  const first = errors?.[0];
  if (!first) return "Delivery failed";
  const detail = first.error_data?.details ?? first.message;
  return `${first.code ? `${first.code}: ` : ""}${first.title ?? "Delivery failed"}${
    detail ? ` (${detail})` : ""
  }`;
}

/**
 * Best-effort text for an inbound message so consumers get something
 * readable without parsing every Meta message type.
 */
function inboundText(message: Record<string, unknown>): string | null {
  const type = message.type as string;
  const part = message[type] as Record<string, unknown> | undefined;
  if (!part) return null;
  switch (type) {
    case "text":
      return typeof part.body === "string" ? part.body : null;
    case "button":
      return typeof part.text === "string" ? part.text : null;
    case "interactive": {
      const reply = (part.button_reply ?? part.list_reply) as { title?: string } | undefined;
      return reply?.title ?? null;
    }
    case "reaction":
      return typeof part.emoji === "string" ? part.emoji : null;
    case "location":
      return [part.latitude, part.longitude].every((v) => typeof v === "number")
        ? `${part.latitude},${part.longitude}`
        : null;
    default:
      // image / video / document / audio / sticker carry an optional caption.
      return typeof part.caption === "string" ? part.caption : null;
  }
}

/**
 * Stores one inbound message and, when it can be attributed to a customer,
 * fans it out as `whatsapp.received`. Attribution: the quoted message's
 * owner first, else whoever last messaged that number from the platform.
 * Returns false for duplicates (Meta redelivers until it sees a 200).
 */
async function recordInboundMessage(
  message: z.infer<typeof metaInboundSchema>,
  value: z.infer<typeof metaChangeSchema>["value"],
  provider: string,
): Promise<boolean> {
  const from = normalizePhone(`+${message.from.replace(/^\+/, "")}`) ?? `+${message.from}`;
  const contact = value.contacts?.find((entry) => entry.wa_id === message.from) ?? value.contacts?.[0];

  let replyTo: typeof whatsappMessage.$inferSelect | undefined;
  if (message.context?.id) {
    [replyTo] = await db
      .select()
      .from(whatsappMessage)
      .where(eq(whatsappMessage.providerMessageId, message.context.id));
  }
  const owner =
    replyTo ??
    (
      await db
        .select()
        .from(whatsappMessage)
        .where(and(eq(whatsappMessage.to, from), eq(whatsappMessage.provider, provider)))
        .orderBy(desc(whatsappMessage.createdAt))
        .limit(1)
    )[0];

  const receivedAt = message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date();
  const row = {
    id: createId("wai"),
    userId: owner?.userId ?? null,
    organizationId: owner?.organizationId ?? null,
    provider,
    providerMessageId: message.id,
    from,
    to: value.metadata?.display_phone_number
      ? normalizePhone(`+${value.metadata.display_phone_number.replace(/^\+/, "")}`)
      : null,
    profileName: contact?.profile?.name ?? null,
    type: message.type,
    text: inboundText(message as Record<string, unknown>),
    replyToMessageId: replyTo?.id ?? null,
    data: message as Record<string, unknown>,
    receivedAt: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
  };
  const inserted = await db.insert(whatsappInbound).values(row).onConflictDoNothing().returning({
    id: whatsappInbound.id,
  });
  if (inserted.length === 0) return false;

  if (!owner) {
    console.warn(`[whatsapp] inbound ${message.id} from ${from} could not be attributed to a user`);
    return true;
  }
  await dispatchWebhookEvent(owner.userId, "whatsapp.received", {
    inboundId: row.id,
    from: row.from,
    to: row.to,
    profileName: row.profileName,
    type: row.type,
    text: row.text,
    replyToMessageId: row.replyToMessageId,
    providerMessageId: row.providerMessageId,
    receivedAt: row.receivedAt.toISOString(),
    data: row.data,
  });
  return true;
}

/**
 * Applies one Meta webhook notification: message statuses move our rows
 * forward, inbound messages are stored and fanned out. Anything unknown,
 * malformed or already applied is ignored (`applied` counts what changed) so
 * the endpoint can always 200 — Meta retries and eventually disables the
 * subscription on anything else.
 */
export async function processMetaWebhook(payload: unknown): Promise<{ applied: number }> {
  const parsed = metaWebhookSchema.safeParse(payload);
  if (!parsed.success || parsed.data.object !== "whatsapp_business_account") return { applied: 0 };

  let applied = 0;
  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;

      for (const status of change.value.statuses ?? []) {
        const mapped = META_STATUS_MAP[status.status.toLowerCase()];
        if (!mapped) continue;
        const error = mapped.status === "failed" ? describeStatusErrors(status.errors) : undefined;
        const result = await applyDeliveryStatus(
          status.id,
          mapped,
          status as Record<string, unknown>,
          error,
        );
        if (result.applied) applied += 1;
      }

      for (const message of change.value.messages ?? []) {
        if (await recordInboundMessage(message, change.value, "meta")) applied += 1;
      }
    }
  }
  return { applied };
}
