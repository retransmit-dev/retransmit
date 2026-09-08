import { UsersTable } from "@/components/admin/users-table";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageHeader } from "@/components/page-shell";
import { navMetadata } from "@/lib/navigation";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = navMetadata("/admin/users");

export default function AdminUsersPage() {
  prefetch(trpc.admin.users.queryOptions());

  return (
    <HydrateClient>
      <PageHeader href="/admin/users" level={2} />
      <ErrorBoundary title="Could not load users">
        <UsersTable />
      </ErrorBoundary>
    </HydrateClient>
  );
}
