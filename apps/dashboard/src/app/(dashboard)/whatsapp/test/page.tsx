import { ErrorBoundary } from "@/components/error-boundary";
import { PageShell } from "@/components/page-shell";
import { TestSendView } from "@/components/whatsapp/test-send-view";
import { navMetadata } from "@/lib/navigation";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = navMetadata("/whatsapp/test");

/**
 * Sends one message through Meta's sandbox number so the exchange can be
 * screen-recorded for App Review. Nothing here touches connected accounts.
 */
export default function WhatsappTestPage() {
  prefetch(trpc.whatsappAccount.testConfig.queryOptions());

  return (
    <HydrateClient>
      <PageShell>
        <ErrorBoundary title="Could not load the test sender">
          <TestSendView />
        </ErrorBoundary>
      </PageShell>
    </HydrateClient>
  );
}
