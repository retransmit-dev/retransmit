import { db } from "@retransmit/db";
import { session, user } from "@retransmit/db/schema/auth";
import { count, desc, eq, max, sql } from "drizzle-orm";

import { adminProcedure, router } from "../index";

export const adminRouter = router({
  /**
   * Every registered user with the last time they were seen. Better Auth
   * creates a session on each sign-in and bumps `updatedAt` when it extends
   * one, so the newest `updatedAt` across a user's sessions is their last
   * connection. Users who never signed in have none.
   */
  users: adminProcedure.query(async () => {
    const lastSeenAt = max(session.updatedAt);
    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        createdAt: user.createdAt,
        lastSeenAt,
        activeSessions: count(
          sql`case when ${session.expiresAt} > now() then 1 end`,
        ),
      })
      .from(user)
      .leftJoin(session, eq(session.userId, user.id))
      .groupBy(user.id)
      .orderBy(sql`${lastSeenAt} desc nulls last`, desc(user.createdAt));

    return rows;
  }),
});
