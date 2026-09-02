import { db } from "@retransmit/db";
import { organization } from "@retransmit/db/schema/auth";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { orgProcedure, router } from "../index";

export const organizationRouter = router({
  /**
   * Returns the organization the session acts on, creating the user's
   * personal organization if they have none yet. The dashboard calls this
   * before using better-auth's organization endpoints so an organization
   * always exists.
   */
  current: orgProcedure.query(async ({ ctx }) => {
    const [row] = await db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdAt: organization.createdAt,
      })
      .from(organization)
      .where(eq(organization.id, ctx.org.id));
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
    return { ...row, role: ctx.org.role };
  }),
});
