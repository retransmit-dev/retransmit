import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { sms, smsEvent } from "@retransmit/db/schema/sms";
import { enqueueSmsSend } from "@retransmit/queue";
import { detectCountry, normalizePhone, smsSegments } from "@retransmit/sms/phone";
import { selectProvider } from "@retransmit/sms/provider";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import z from "zod";

import { apiKeyAuth } from "../auth";
import type { ApiKeyEnv } from "../auth";

const phoneList = z
  .union([z.string(), z.array(z.string()).min(1).max(50)])
  .transform((value) => (Array.isArray(value) ? value : [value]))
  .refine((values) => values.every((value) => normalizePhone(value) !== null), {
    message:
      "Contains an invalid phone number. Numbers must be in international format, e.g. +237670000000",
  });

const sendSmsSchema = z.object({
  /** Sender id shown on the device. Falls back to the routed provider's default. */
  from: z
    .string()
    .min(1)
    .max(11)
    .regex(/^[a-zA-Z0-9 _-]+$/, "Sender id may only contain letters, digits, space, - and _")
    .optional(),
  to: phoneList,
  text: z.string().min(1).max(1600),
});

export const smsRoutes = new Hono<ApiKeyEnv>();

smsRoutes.use("*", apiKeyAuth);

/**
 * Queues a single SMS. The destination country is detected from the number
 * prefix and the message is routed to the cheapest configured provider for
 * that country (see @retransmit/sms/provider). Returns 202 immediately; the
 * worker sends it with retries and a dead-letter queue.
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
  if (!selectProvider(country)) {
    return c.json(
      {
        error: {
          code: "no_route",
          message: `No SMS provider is configured for ${country ?? "this destination"} yet`,
        },
      },
      422,
    );
  }

  const row = {
    id: createId("sms"),
    userId: c.get("userId"),
    organizationId: c.get("organizationId"),
    apiKeyId: c.get("apiKeyId"),
    from: input.from,
    to,
    text: input.text,
    country,
    segments: smsSegments(input.text),
  };
  const [created] = await db.insert(sms).values(row).returning();
  if (!created) {
    return c.json({ error: { code: "internal_error", message: "Could not create sms" } }, 500);
  }

  await enqueueSmsSend(row.id);

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
