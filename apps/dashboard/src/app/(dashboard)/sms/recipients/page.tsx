import { ErrorBoundary } from "@/components/error-boundary";
import { PageShell } from "@/components/page-shell";
import { SmsComplianceView } from "@/components/sms/sms-compliance-view";
import { navMetadata } from "@/lib/navigation";
import { batchPrefetch, HydrateClient, trpc } from "@/trpc/server";

export const metadata = navMetadata("/sms/recipients");

export default function SmsRecipientsPage() {
  batchPrefetch([
    trpc.smsCompliance.list.queryOptions(),
    trpc.smsCompliance.programs.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <PageShell>
        <ErrorBoundary title="Could not load SMS compliance records">
          <SmsComplianceView />
        </ErrorBoundary>
      </PageShell>
    </HydrateClient>
  );
}
