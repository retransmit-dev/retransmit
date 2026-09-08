import { SmsProvidersTable } from "@/components/admin/sms-providers";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageHeader } from "@/components/page-shell";
import { navMetadata } from "@/lib/navigation";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = navMetadata("/admin/sms-routing");

export default function AdminSmsRoutingPage() {
  prefetch(trpc.admin.smsProviders.queryOptions());

  return (
    <HydrateClient>
      <PageHeader
        href="/admin/sms-routing"
        level={2}
        description="Providers this deployment has credentials for. Routing picks the cheapest one covering the destination; customers never choose."
      />
      <ErrorBoundary title="Could not load SMS routing">
        <SmsProvidersTable />
      </ErrorBoundary>
    </HydrateClient>
  );
}
