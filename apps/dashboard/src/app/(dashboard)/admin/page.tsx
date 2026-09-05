import { UsersTable } from "@/components/admin/users-table";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageHeader, PageShell } from "@/components/page-shell";
import { navMetadata } from "@/lib/navigation";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { auth } from "@retransmit/auth";
import { isAdminEmail } from "@retransmit/auth/admin";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export const metadata = navMetadata("/admin");

/**
 * Operator-only. The layout already guarantees a session; this page also
 * checks the allowlist and answers 404 to anyone else, so the route does not
 * reveal itself. The tRPC procedure behind the table makes the same check.
 */
export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!isAdminEmail(session?.user.email)) notFound();

  prefetch(trpc.admin.users.queryOptions());

  return (
    <HydrateClient>
      <PageShell>
        <PageHeader href="/admin" />
        <ErrorBoundary title="Could not load users">
          <UsersTable />
        </ErrorBoundary>
      </PageShell>
    </HydrateClient>
  );
}
