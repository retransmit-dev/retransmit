import { ErrorBoundary } from "@/components/error-boundary";
import { PageShell } from "@/components/page-shell";
import { SmsTestSendView } from "@/components/sms/sms-test-send-view";
import { navMetadata } from "@/lib/navigation";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = navMetadata("/sms/test");

/**
 * Queues one message through the real send path so a provider can be checked
 * end to end. The result lands in the SMS log like any API send.
 */
export default function SmsTestPage() {
  prefetch(trpc.sms.providers.queryOptions());

  return (
    <HydrateClient>
      <PageShell>
        <ErrorBoundary title="Could not load the test sender">
          <SmsTestSendView />
        </ErrorBoundary>
      </PageShell>
    </HydrateClient>
  );
}
