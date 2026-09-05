import { createHash } from "node:crypto";

import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { idempotencyKey } from "@retransmit/db/schema/email";
import { and, eq, lte } from "drizzle-orm";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
export const IDEMPOTENCY_KEY_MAX = 256;
/** How long a key is remembered. Matches the 24 hours Resend and Stripe use. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export interface ErrorBody {
  error: { code: string; message: string };
}

interface RouteResponse {
  status: ContentfulStatusCode;
  body: Record<string, unknown>;
}

/**
 * Reads the `Idempotency-Key` header. Absent means the request is not
 * idempotent, which is fine; present but empty or too long is a client error.
 */
export function readIdempotencyKey(
  c: Context,
): { key: string | null; error?: undefined } | { key?: undefined; error: ErrorBody } {
  const raw = c.req.header(IDEMPOTENCY_KEY_HEADER);
  if (raw === undefined) return { key: null };
  const key = raw.trim();
  if (key.length === 0 || key.length > IDEMPOTENCY_KEY_MAX) {
    return {
      error: {
        error: {
          code: "invalid_idempotency_key",
          message: `\`${IDEMPOTENCY_KEY_HEADER}\` must be between 1 and ${IDEMPOTENCY_KEY_MAX} characters`,
        },
      },
    };
  }
  return { key };
}

/** JSON with object keys sorted at every level, so equal payloads hash equally. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, item]) => `${JSON.stringify(name)}:${stableStringify(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function hashRequest(endpoint: string, body: unknown): string {
  return createHash("sha256").update(`${endpoint}\n${stableStringify(body)}`).digest("hex");
}

/**
 * Runs `perform` at most once per `(organization, key)` within the TTL.
 *
 * The first request reserves the key, performs the send, and stores the 202
 * response. A retry with the same key and payload gets that stored response
 * back with `replayed: true`. A retry with a different payload is rejected
 * with 409 `invalid_idempotent_request`; one that arrives while the first is
 * still running gets 409 `concurrent_idempotent_requests`. A reservation whose
 * send fails (non-2xx or thrown) is released so the caller can retry.
 *
 * Without a key, `perform` simply runs.
 */
export async function runIdempotent(
  input: { organizationId: string; key: string | null; endpoint: string; body: unknown },
  perform: () => Promise<RouteResponse>,
): Promise<RouteResponse & { replayed: boolean }> {
  if (input.key === null) return { ...(await perform()), replayed: false };

  const now = new Date();
  const requestHash = hashRequest(input.endpoint, input.body);
  const scope = eq(idempotencyKey.organizationId, input.organizationId);

  // Keep the table from growing without a scheduler: each reservation sweeps
  // the organization's expired keys. Cheap thanks to the (org, expires_at) index.
  await db.delete(idempotencyKey).where(and(scope, lte(idempotencyKey.expiresAt, now)));

  const reservation = {
    requestHash,
    status: "in_progress" as const,
    responseStatus: null,
    responseBody: null,
    createdAt: now,
    expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
  };
  // Insert wins on a fresh key; on conflict it only takes over an expired
  // row (`setWhere`), so a live row is never clobbered. No row back means
  // someone else holds the key.
  const [owned] = await db
    .insert(idempotencyKey)
    .values({
      id: createId("idem"),
      organizationId: input.organizationId,
      key: input.key,
      ...reservation,
    })
    .onConflictDoUpdate({
      target: [idempotencyKey.organizationId, idempotencyKey.key],
      set: reservation,
      setWhere: lte(idempotencyKey.expiresAt, now),
    })
    .returning({ id: idempotencyKey.id });

  if (!owned) {
    const [existing] = await db
      .select()
      .from(idempotencyKey)
      .where(and(scope, eq(idempotencyKey.key, input.key)));
    if (existing && existing.requestHash !== requestHash) {
      return {
        status: 409,
        body: {
          error: {
            code: "invalid_idempotent_request",
            message: `\`${IDEMPOTENCY_KEY_HEADER}\` was already used with a different payload. Use a new key or send the original payload.`,
          },
        },
        replayed: false,
      };
    }
    if (
      existing &&
      existing.status === "completed" &&
      existing.responseStatus !== null &&
      existing.responseBody !== null
    ) {
      return {
        status: existing.responseStatus as ContentfulStatusCode,
        body: existing.responseBody,
        replayed: true,
      };
    }
    // Still in progress, or gone between the upsert and the select (its
    // owner failed and released it). Either way the caller should retry.
    return {
      status: 409,
      body: {
        error: {
          code: "concurrent_idempotent_requests",
          message: `Another request with this \`${IDEMPOTENCY_KEY_HEADER}\` is still in progress. Retry in a moment.`,
        },
      },
      replayed: false,
    };
  }

  let response: RouteResponse | undefined;
  try {
    response = await perform();
    if (response.status >= 200 && response.status < 300) {
      await db
        .update(idempotencyKey)
        .set({ status: "completed", responseStatus: response.status, responseBody: response.body })
        .where(eq(idempotencyKey.id, owned.id));
    }
    return { ...response, replayed: false };
  } finally {
    if (!response || response.status < 200 || response.status >= 300) {
      await db
        .delete(idempotencyKey)
        .where(eq(idempotencyKey.id, owned.id))
        .catch(() => {
          // The row expires on its own; a stale reservation only costs one retry.
        });
    }
  }
}

/** Sends a `runIdempotent` result, flagging replays with `Idempotent-Replayed: true`. */
export function sendIdempotent(c: Context, result: RouteResponse & { replayed: boolean }) {
  if (result.replayed) c.header("Idempotent-Replayed", "true");
  return c.json(result.body, result.status);
}
