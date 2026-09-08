import { SmsRatesTable } from "@/components/admin/sms-rates";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageHeader } from "@/components/page-shell";
import { navMetadata } from "@/lib/navigation";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = navMetadata("/admin/sms-rates");

export default function AdminSmsRatesPage() {
  prefetch(trpc.admin.smsRates.queryOptions());

  return (
    <HydrateClient>
      <PageHeader
        href="/admin/sms-rates"
        level={2}
        description="Priced per segment, per destination. Margin is judged against the carrier routing would actually use, not the AWS fallback."
      />
      <ErrorBoundary title="Could not load SMS rates">
        <SmsRatesTable />
      </ErrorBoundary>
    </HydrateClient>
  );
}
