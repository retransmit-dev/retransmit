import { checkPayAsYouGo, recordUsage, smsUnits } from "@retransmit/billing";
import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { SMS_PROVIDER_NAMES, sms, smsEvent } from "@retransmit/db/schema/sms";
import { enqueueSmsSend } from "@retransmit/queue";
import { detectCountry, normalizePhone, smsSegments } from "@retransmit/sms/phone";
import { selectProvider } from "@retransmit/sms/provider";
import { SenderNotAllowedError, resolveSender } from "@retransmit/sms/senders";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import z from "zod";

import { apiKeyAuth } from "../auth";
import type { ApiKeyEnv } from "../auth";
import { limitErrorResponse, limitFailure } from "../billing";

const phoneList = z
  .union([z.string(), z.array(z.string()).min(1).max(50)])
  .transform((value) => (Array.isArray(value) ? value : [value]))
  .refine((values) => values.every((value) => normalizePhone(value) !== null), {
    message:
      "Contains an invalid phone number. Numbers must be in international format and valid for their country, e.g. +237670000000",
  });

const sendSmsSchema = z.object({
  /**
   * Sender id shown on the device. Must be one this organization has had
   * approved for the destination country (SMS > Sender IDs in the dashboard).
   * Omit it to use the organization's approved sender for that country, or
   * the provider default when it has none.
   */
  from: z
    .string()
    .min(1)
    .max(11)
    .regex(/^[a-zA-Z0-9 _-]+$/, "Sender id may only contain letters, digits, space, - and _")
    .optional(),
  to: phoneList,
  text: z.string().min(1).max(1600),
  /**
   * Pins the send to one carrier. Omit it to let Retransmit route by
   * destination country and price.
   */
  provider: z.enum(SMS_PROVIDER_NAMES).optional(),
});

export const smsRoutes = new Hono<ApiKeyEnv>();

smsRoutes.use("*", apiKeyAuth);

/**
 * Queues a single SMS. The destination country is detected from the number
 * prefix and the message is routed to the cheapest configured provider for
 * that country, or to `provider` when the caller names one (see
 * @retransmit/sms/provider). Returns 202 immediately; the worker sends it
 * with retries and a dead-letter queue.
 */
smsRoutes.post("/", async (c) => {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    return c.json({ error: { code: "invalid_json", message: "Body must be valid JSON" } }, 400);
  }

  const parsed = sendSmsSchema.safeParse(json);
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

  const to = input.to.map((value) => normalizePhone(value)!);
  const countries = [...new Set(to.map(detectCountry))];
  if (countries.length > 1) {
    return c.json(
      {
        error: {
          code: "validation_error",
          message:
            "All recipients must be in the same country; send one request per destination country",
        },
      },
      422,
    );
  }
  const country = countries[0] ?? null;

  // Fail fast on unroutable destinations instead of queueing a doomed job.
  // The worker re-routes at send time, so this is only an availability check.
  if (!selectProvider(country, input.provider)) {
    return c.json(
      {
        error: {
          code: "no_route",
          message: input.provider
            ? `The ${input.provider} provider is not configured for ${country ?? "this destination"}`
            : `No SMS provider is configured for ${country ?? "this destination"} yet`,
        },
      },
      422,
    );
  }

  // SMS has no included allowance on any plan, so it needs a card rather than
  // a quota check.
  const organizationId = c.get("organizationId");
  const unpayable = limitFailure(await checkPayAsYouGo(organizationId, "SMS"));
  if (unpayable) {
    const { status, body } = limitErrorResponse(unpayable);
    return c.json(body, status);
  }

  // The sender id is settled before queueing so a caller learns straight away
  // that a name is not approved, rather than finding a failed row later.
  let from: string | null;
  try {
    ({ from } = await resolveSender(organizationId ?? null, country, input.from));
  } catch (cause) {
    if (cause instanceof SenderNotAllowedError) {
      return c.json({ error: { code: cause.code, message: cause.message } }, 422);
    }
    throw cause;
  }

  const row = {
    id: createId("sms"),
    userId: c.get("userId"),
    organizationId,
    apiKeyId: c.get("apiKeyId"),
    from,
    to,
    text: input.text,
    country,
    segments: smsSegments(input.text),
    requestedProvider: input.provider,
  };
  const [created] = await db.insert(sms).values(row).returning();
  if (!created) {
    return c.json({ error: { code: "internal_error", message: "Could not create sms" } }, 500);
  }

  await enqueueSmsSend(row.id);

  // Priced from the destination's rate card, not from whichever carrier
  // routing happened to pick: a customer's bill must not move because we
  // switched them from MTN to Orange behind the scenes.
  await recordUsage(organizationId, "sms", await smsUnits(country, row.segments, to.length));

  return c.json(
    {
      id: row.id,
      status: "queued",
      country,
      segments: row.segments,
      created_at: created.createdAt.toISOString(),
    },
    202,
  );
});

smsRoutes.get("/:id", async (c) => {
  const [row] = await db
    .select()
    .from(sms)
    .where(and(eq(sms.id, c.req.param("id")), eq(sms.userId, c.get("userId"))));
  if (!row) {
    return c.json({ error: { code: "not_found", message: "SMS not found" } }, 404);
  }

  const events = await db
    .select({ type: smsEvent.type, createdAt: smsEvent.createdAt })
    .from(smsEvent)
    .where(eq(smsEvent.smsId, row.id))
    .orderBy(asc(smsEvent.createdAt));

  return c.json({
    id: row.id,
    from: row.from,
    to: row.to,
    text: row.text,
    country: row.country,
    segments: row.segments,
    requested_provider: row.requestedProvider,
    provider: row.provider,
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
