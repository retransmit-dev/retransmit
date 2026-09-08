import { ErrorBoundary } from "@/components/error-boundary";
import { PageShell } from "@/components/page-shell";
import { SendersView } from "@/components/sms/senders-view";
import { navMetadata } from "@/lib/navigation";
import { batchPrefetch, HydrateClient, trpc } from "@/trpc/server";

export const metadata = navMetadata("/sms/senders");

export default function SmsSendersPage() {
  batchPrefetch([
    trpc.smsSender.list.queryOptions(),
    // The country catalog backs both the request form and the country chips
    // in the table, so it is worth having before the first paint.
    trpc.smsSender.countries.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <PageShell>
        <ErrorBoundary title="Could not load sender ids">
          <SendersView />
        </ErrorBoundary>
      </PageShell>
    </HydrateClient>
  );
}
