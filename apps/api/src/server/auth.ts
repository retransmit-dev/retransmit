import { ensureOrganizationForUser } from "@retransmit/auth/organization";
import { db } from "@retransmit/db";
import { apiKey } from "@retransmit/db/schema/email";
import { hashApiKey } from "@retransmit/email/api-keys";
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";

export interface ApiKeyEnv {
  Variables: {
    userId: string;
    apiKeyId: string;
    organizationId: string;
  };
}

/** Authenticates `Authorization: Bearer rt_...` against stored key hashes. */
export const apiKeyAuth = createMiddleware<ApiKeyEnv>(async (c, next) => {
  const header = c.req.header("authorization");
  const key = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
  if (!key || !key.startsWith("rt_")) {
    return c.json(
      {
        error: {
          code: "unauthorized",
          message: "Provide your API key as `Authorization: Bearer rt_...`",
        },
      },
      401,
    );
  }

  const [row] = await db.select().from(apiKey).where(eq(apiKey.keyHash, hashApiKey(key)));
  if (!row || row.revokedAt) {
    return c.json(
      { error: { code: "unauthorized", message: "Invalid or revoked API key" } },
      401,
    );
  }

  // Keys created before organizations existed get one resolved (and
  // stamped) on first use.
  let organizationId = row.organizationId;
  if (!organizationId) {
    organizationId = (await ensureOrganizationForUser(row.userId)).id;
    await db.update(apiKey).set({ organizationId }).where(eq(apiKey.id, row.id));
  }

  c.set("userId", row.userId);
  c.set("apiKeyId", row.id);
  c.set("organizationId", organizationId);

  db.update(apiKey)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKey.id, row.id))
    .catch(() => {
      // Best-effort bookkeeping; never block the request on it.
    });

  await next();
});
