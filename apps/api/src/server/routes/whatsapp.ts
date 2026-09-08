import { checkPayAsYouGo, recordUsage, whatsappUnits } from "@retransmit/billing";
import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import type { WhatsappBillingCategory } from "@retransmit/db/schema/billing";
import {
  WHATSAPP_MESSAGE_TYPES,
  whatsappEvent,
  whatsappMessage,
  whatsappTemplate,
} from "@retransmit/db/schema/whatsapp";
import { enqueueWhatsappSend } from "@retransmit/queue";
import { detectCountry, normalizePhone } from "@retransmit/sms/phone";
import { WhatsappAccountError, resolveSenderAccount } from "@retransmit/whatsapp/accounts";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import z from "zod";

import { apiKeyAuth } from "../auth";
import type { ApiKeyEnv } from "../auth";
import { limitErrorResponse, limitFailure } from "../billing";

const mediaSchema = z.object({
  /** Public HTTPS link Meta fetches at send time. */
  link: z.string().url().max(2048),
  caption: z.string().max(1024).optional(),
});

const sendWhatsappSchema = z
  .object({
    /** Connected number to send from (E.164 or `wab_` id). Optional with a single number. */
    from: z.string().min(1).max(64).optional(),
    to: z.string().refine((value) => normalizePhone(value) !== null, {
      message:
        "Invalid phone number. Numbers must be in international format and valid for their country, e.g. +237670000000",
    }),
    /** Defaults to `text`. */
    type: z.enum(WHATSAPP_MESSAGE_TYPES).default("text"),
    /** Body for `text` messages (max 4096 chars). Caption for media when the media object has none. */
    text: z.string().min(1).max(4096).optional(),
    /** Render a preview for the first link in a `text` message. */
    preview_url: z.boolean().optional(),
    template: z
      .object({
        name: z.string().min(1).max(512),
        language: z.string().min(2).max(16),
        components: z.array(z.record(z.string(), z.unknown())).optional(),
      })
      .optional(),
    image: mediaSchema.optional(),
    document: mediaSchema.extend({ filename: z.string().max(240).optional() }).optional(),
  })
  .superRefine((input, ctx) => {
    const requires: Record<(typeof WHATSAPP_MESSAGE_TYPES)[number], keyof typeof input> = {
      text: "text",
      template: "template",
      image: "image",
      document: "document",
    };
    const field = requires[input.type];
    if (input[field] === undefined) {
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: `Required for type "${input.type}"`,
      });
    }
  });

/**
 * Which of Meta's billing categories a send falls into.
 *
 * A template carries its own category, so the price of the same message
 * differs by a factor of four between authentication and marketing. Anything
 * else is free-form and only delivers inside the 24-hour customer service
 * window, which is the `service` category. An unknown template name is priced
 * as `utility`: Meta will most likely reject the send anyway, and guessing
 * `marketing` would overcharge for something that never arrived.
 */
async function billingCategory(
  organizationId: string,
  input: { type: string; template?: { name: string; language: string } | undefined },
): Promise<WhatsappBillingCategory> {
  if (input.type !== "template" || !input.template) return "service";
  const [row] = await db
    .select({ category: whatsappTemplate.category })
    .from(whatsappTemplate)
    .where(
      and(
        eq(whatsappTemplate.organizationId, organizationId),
        eq(whatsappTemplate.name, input.template.name),
        eq(whatsappTemplate.language, input.template.language),
      ),
    );
  return row?.category ?? "utility";
}

export const whatsappRoutes = new Hono<ApiKeyEnv>();

whatsappRoutes.use("*", apiKeyAuth);

/**
 * Queues a single WhatsApp message to one recipient from one of the
 * organization's connected numbers (see @retransmit/whatsapp/accounts).
 * Returns 202 immediately; the worker sends it with retries and a
 * dead-letter queue.
 *
 * Business-initiated conversations must start with an approved `template`;
 * free-form `text` and media only deliver inside the 24-hour customer
 * service window that opens when the recipient messages you.
 */
whatsappRoutes.post("/", async (c) => {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    return c.json({ error: { code: "invalid_json", message: "Body must be valid JSON" } }, 400);
  }

  const parsed = sendWhatsappSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return c.json(
      {
        error: {
          code: "validation_error",
          message: issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "Invalid body",
        },
      },
      422,
    );
  }
  const input = parsed.data;

  const to = normalizePhone(input.to)!;
  const country = detectCountry(to);

  // WhatsApp is pay as you go on every plan, so it needs a card, not a quota.
  const organizationId = c.get("organizationId");
  const unpayable = limitFailure(await checkPayAsYouGo(organizationId, "WhatsApp"));
  if (unpayable) {
    const { status, body } = limitErrorResponse(unpayable);
    return c.json(body, status);
  }

  let account;
  try {
    account = await resolveSenderAccount(organizationId, input.from);
  } catch (cause) {
    if (cause instanceof WhatsappAccountError) {
      return c.json(
        {
          error: {
            code: cause.code === "ambiguous" ? "validation_error" : "no_whatsapp_account",
            message: cause.message,
          },
        },
        422,
      );
    }
    throw cause;
  }

  const media = input.type === "image" ? input.image : input.type === "document" ? input.document : null;
  const row = {
    id: createId("wa"),
    userId: c.get("userId"),
    organizationId,
    apiKeyId: c.get("apiKeyId"),
    accountId: account.id,
    from: account.phoneNumber,
    to,
    country,
    type: input.type,
    text: input.text ?? media?.caption ?? null,
    previewUrl: input.preview_url ?? false,
    template: input.type === "template" ? (input.template ?? null) : null,
    media: media ?? null,
  };
  const [created] = await db.insert(whatsappMessage).values(row).returning();
  if (!created) {
    return c.json({ error: { code: "internal_error", message: "Could not create message" } }, 500);
  }

  await enqueueWhatsappSend(row.id);
  await recordUsage(
    organizationId,
    "whatsapp",
    await whatsappUnits(country, await billingCategory(organizationId, input)),
  );

  return c.json(
    {
      id: row.id,
      status: "queued",
      type: row.type,
      from: row.from,
      country,
      created_at: created.createdAt.toISOString(),
    },
    202,
  );
});

whatsappRoutes.get("/:id", async (c) => {
  const [row] = await db
    .select()
    .from(whatsappMessage)
    .where(and(eq(whatsappMessage.id, c.req.param("id")), eq(whatsappMessage.userId, c.get("userId"))));
  if (!row) {
    return c.json({ error: { code: "not_found", message: "WhatsApp message not found" } }, 404);
  }

  const events = await db
    .select({ type: whatsappEvent.type, createdAt: whatsappEvent.createdAt })
    .from(whatsappEvent)
    .where(eq(whatsappEvent.messageId, row.id))
    .orderBy(asc(whatsappEvent.createdAt));

  return c.json({
    id: row.id,
    from: row.from,
    to: row.to,
    country: row.country,
    type: row.type,
    text: row.text,
    preview_url: row.previewUrl,
    template: row.template,
    media: row.media,
    provider: row.provider,
    provider_message_id: row.providerMessageId,
    status: row.status,
    error: row.error,
    created_at: row.createdAt.toISOString(),
    last_event_at: row.lastEventAt?.toISOString() ?? null,
    events: events.map((event) => ({
      type: event.type,
      created_at: event.createdAt.toISOString(),
    })),
  });
});
