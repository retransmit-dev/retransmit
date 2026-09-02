import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { member, organization, user } from "@retransmit/db/schema/auth";
import { apiKey, domain, email } from "@retransmit/db/schema/email";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

export interface ActiveOrganization {
  id: string;
  role: string;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "org"
  );
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Moves resources created before organizations existed (or before the user
 * had one) into the given organization.
 */
async function claimUserResources(tx: Tx, userId: string, organizationId: string): Promise<void> {
  await tx
    .update(domain)
    .set({ organizationId })
    .where(and(eq(domain.userId, userId), isNull(domain.organizationId)));
  await tx
    .update(apiKey)
    .set({ organizationId })
    .where(and(eq(apiKey.userId, userId), isNull(apiKey.organizationId)));
  await tx
    .update(email)
    .set({ organizationId })
    .where(and(eq(email.userId, userId), isNull(email.organizationId)));
}

/**
 * Returns the user's first organization membership, creating a personal
 * organization (with the user as owner) if they have none. Existing
 * user-scoped resources are claimed by the new organization so nothing
 * disappears from the dashboard.
 */
export async function ensureOrganizationForUser(userId: string): Promise<ActiveOrganization> {
  return await db.transaction(async (tx) => {
    // Concurrent requests (e.g. a tRPC batch) must not each create an
    // organization for the same user.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

    const [existing] = await tx
      .select({ organizationId: member.organizationId, role: member.role })
      .from(member)
      .where(eq(member.userId, userId))
      .orderBy(asc(member.createdAt))
      .limit(1);
    if (existing) return { id: existing.organizationId, role: existing.role };

    const [owner] = await tx.select().from(user).where(eq(user.id, userId));
    if (!owner) throw new Error(`Cannot create organization: user ${userId} not found`);

    const name = owner.name.trim() || owner.email.split("@")[0] || "Personal";
    const organizationId = createId("org");
    await tx.insert(organization).values({
      id: organizationId,
      name,
      slug: `${slugify(name)}-${createId("").slice(1, 9)}`,
    });
    await tx.insert(member).values({
      id: createId("mem"),
      organizationId,
      userId,
      role: "owner",
    });
    await claimUserResources(tx, userId, organizationId);

    return { id: organizationId, role: "owner" };
  });
}

/**
 * Resolves which organization a request should act on: the session's active
 * organization if the user is (still) a member of it, otherwise their first
 * membership, otherwise a freshly created personal organization.
 */
export async function resolveActiveOrganization(
  userId: string,
  activeOrganizationId?: string | null,
): Promise<ActiveOrganization> {
  if (activeOrganizationId) {
    const [row] = await db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, activeOrganizationId), eq(member.userId, userId)));
    if (row) return { id: activeOrganizationId, role: row.role };
  }
  return await ensureOrganizationForUser(userId);
}
