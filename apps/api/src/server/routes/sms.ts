import { checkPayAsYouGo, isCloudMode, recordUsage, smsUnits } from "@retransmit/billing";
import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import {
  SMS_CONSENT_METHODS,
  SMS_PROVIDER_NAMES,
  SMS_PURPOSES,
  SMS_SUPPRESSION_REASONS,
  sms,
  smsConsent,
  smsEvent,
  smsSuppression,
} from "@retransmit/db/schema/sms";
import { enqueueSmsSend } from "@retransmit/queue";
import { detectCountry, normalizePhone, smsSegments } from "@retransmit/sms/phone";
import { selectProvider } from "@retransmit/sms/provider";
import { SenderNotAllowedError, resolveSender } from "@retransmit/sms/senders";
import {
  allowedSmsCountries,
  checkSmsCompliance,
  formatProgramMessage,
} from "@retransmit/sms/compliance";
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
   * approved for the destination country (SMS > Programs in the dashboard).
   */
  from: z
    .string()
    .min(1)
    .max(11)
    .regex(/^[a-zA-Z0-9 _-]+$/, "Sender id may only contain letters, digits, space, - and _"),
  to: phoneList,
  text: z.string().min(1).max(1500),
  /** Declared transactional purpose, checked against the program and consent. */
  purpose: z.enum(SMS_PURPOSES),
  /**
   * Pins the send to one carrier. Omit it to let Retransmit route by
   * destination country and price.
   */
  provider: z.enum(SMS_PROVIDER_NAMES).optional(),
});

export const smsRoutes = new Hono<ApiKeyEnv>();

smsRoutes.use("*", apiKeyAuth);

const senderName = z
  .string()
  .trim()
  .min(1)
  .max(11)
  .regex(/^[a-zA-Z0-9 _-]+$/);

const recordConsentSchema = z.object({
  from: senderName,
  phone: z.string(),
  purposes: z.array(z.enum(SMS_PURPOSES)).min(1),
  method: z.enum(SMS_CONSENT_METHODS),
  source: z.string().trim().min(3).max(500),
  disclosure_text: z.string().trim().min(20).max(4000),
  evidence_url: z.url({ protocol: /^https$/ }).max(1000).optional(),
  consented_at: z.iso.datetime({ offset: true }).optional(),
  confirmed_at: z.iso.datetime({ offset: true }).optional(),
});

const optOutSchema = z.object({
  phone: z.string(),
  reason: z.enum(SMS_SUPPRESSION_REASONS).default("opt_out"),
  source: z.string().trim().min(3).max(500),
});

/** Records the proof that must exist before POST /v1/sms accepts a recipient. */
smsRoutes.post("/consents", async (c) => {
  const parsed = recordConsentSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: { code: "validation_error", message: parsed.error.issues[0]?.message ?? "Invalid consent" } },
      422,
    );
  }
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return c.json({ error: { code: "validation_error", message: "phone must be valid E.164" } }, 422);
  }
  const country = detectCountry(phone);
  if (!country || !allowedSmsCountries().has(country)) {
    return c.json(
      { error: { code: "sms_country_not_allowed", message: "SMS is currently limited to Cameroon" } },
      422,
    );
  }

  let program;
  try {
    ({ program } = await resolveSender(c.get("organizationId"), country, parsed.data.from));
  } catch (cause) {
    if (cause instanceof SenderNotAllowedError) {
      return c.json({ error: { code: cause.code, message: cause.message } }, 422);
    }
    throw cause;
  }
  const invalidPurpose = parsed.data.purposes.find((purpose) => !program.purposes.includes(purpose));
  if (invalidPurpose) {
    return c.json(
      {
        error: {
          code: "sms_purpose_not_allowed",
          message: `${invalidPurpose} is not approved for ${program.senderId}`,
        },
      },
      422,
    );
  }

  const now = new Date();
  const consentedAt = parsed.data.consented_at ? new Date(parsed.data.consented_at) : now;
  const confirmedAt = parsed.data.confirmed_at ? new Date(parsed.data.confirmed_at) : null;
  const [consent] = await db
    .insert(smsConsent)
    .values({
      id: createId("scn"),
      organizationId: c.get("organizationId"),
      smsSenderId: program.id,
      phone,
      purposes: [...new Set(parsed.data.purposes)],
      method: parsed.data.method,
      source: parsed.data.source,
      disclosureText: parsed.data.disclosure_text,
      evidenceUrl: parsed.data.evidence_url ?? null,
      consentedAt,
      confirmedAt,
      optedOutAt: null,
    })
    .onConflictDoUpdate({
      target: [smsConsent.organizationId, smsConsent.smsSenderId, smsConsent.phone],
      set: {
        purposes: [...new Set(parsed.data.purposes)],
        method: parsed.data.method,
        source: parsed.data.source,
        disclosureText: parsed.data.disclosure_text,
        evidenceUrl: parsed.data.evidence_url ?? null,
        consentedAt,
        confirmedAt,
        optedOutAt: null,
      },
    })
    .returning();
  await db
    .delete(smsSuppression)
    .where(
      and(
        eq(smsSuppression.organizationId, c.get("organizationId")),
        eq(smsSuppression.phone, phone),
      ),
    );
  return c.json(
    {
      id: consent!.id,
      phone,
      from: program.senderId,
      purposes: consent!.purposes,
      consented_at: consent!.consentedAt.toISOString(),
    },
    201,
  );
});

/** Immediately blocks a number across every SMS program in the organization. */
smsRoutes.post("/opt-outs", async (c) => {
  const parsed = optOutSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: { code: "validation_error", message: parsed.error.issues[0]?.message ?? "Invalid opt-out" } },
      422,
    );
  }
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return c.json({ error: { code: "validation_error", message: "phone must be valid E.164" } }, 422);
  }
  const now = new Date();
  const [suppression] = await db
    .insert(smsSuppression)
    .values({
      id: createId("ssp"),
      organizationId: c.get("organizationId"),
      phone,
      reason: parsed.data.reason,
      source: parsed.data.source,
    })
    .onConflictDoUpdate({
      target: [smsSuppression.organizationId, smsSuppression.phone],
      set: { reason: parsed.data.reason, source: parsed.data.source },
    })
    .returning();
  await db
    .update(smsConsent)
    .set({ optedOutAt: now })
    .where(
      and(eq(smsConsent.organizationId, c.get("organizationId")), eq(smsConsent.phone, phone)),
    );
  return c.json({ id: suppression!.id, phone, opted_out_at: now.toISOString() }, 201);
});

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

  if (!country || !allowedSmsCountries().has(country)) {
    return c.json(
      { error: { code: "sms_country_not_allowed", message: "SMS is currently limited to Cameroon" } },
      422,
    );
  }

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

  // Cloud SMS has no included allowance, so it needs a card. Self-hosters pay
  // the configured provider directly and the policy check allows the send.
  const organizationId = c.get("organizationId");
  const unpayable = limitFailure(await checkPayAsYouGo(organizationId, "SMS"));
  if (unpayable) {
    const { status, body } = limitErrorResponse(unpayable);
    return c.json(body, status);
  }

  // The sender id is settled before queueing so a caller learns straight away
  // that a name is not approved, rather than finding a failed row later. It
  // also decides the region: an AWS sender id only exists in the region it
  // was registered in.
  let from: string | null;
  let region: string | null;
  let program: Awaited<ReturnType<typeof resolveSender>>["program"];
  try {
    ({ from, region, program } = await resolveSender(organizationId ?? null, country, input.from));
  } catch (cause) {
    if (cause instanceof SenderNotAllowedError) {
      return c.json({ error: { code: cause.code, message: cause.message } }, 422);
    }
    throw cause;
  }

  const complianceFailure = await checkSmsCompliance({
    organizationId,
    program,
    recipients: to,
    purpose: input.purpose,
    country,
  });
  if (complianceFailure) {
    return c.json(
      { error: complianceFailure },
      complianceFailure.code === "sms_rate_limit" ? 429 : 422,
    );
  }

  const text = formatProgramMessage(program, input.text);
  if (text.length > 1600) {
    return c.json(
      { error: { code: "validation_error", message: "text is too long after the required brand and opt-out footer" } },
      422,
    );
  }

  const row = {
    id: createId("sms"),
    userId: c.get("userId"),
    organizationId,
    apiKeyId: c.get("apiKeyId"),
    smsSenderId: program.id,
    from,
    to,
    text,
    purpose: input.purpose,
    country,
    region,
    segments: smsSegments(text),
    requestedProvider: input.provider,
  };
  const [created] = await db.insert(sms).values(row).returning();
  if (!created) {
    return c.json({ error: { code: "internal_error", message: "Could not create sms" } }, 500);
  }

  await enqueueSmsSend(row.id);

  if (isCloudMode()) {
    // Priced from the destination's rate card, not from whichever carrier
    // routing happened to pick: a customer's bill must not move because we
    // switched them from MTN to Orange behind the scenes.
    await recordUsage(organizationId, "sms", await smsUnits(country, row.segments, to.length));
  }

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
