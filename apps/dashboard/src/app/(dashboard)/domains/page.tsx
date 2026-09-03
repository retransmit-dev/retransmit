import { DomainsView } from "@/components/domains/domains-view";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageShell } from "@/components/page-shell";
import { navMetadata } from "@/lib/navigation";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = navMetadata("/domains");

export default function DomainsPage() {
  prefetch(trpc.domain.list.queryOptions());

  return (
    <HydrateClient>
      <PageShell>
        <ErrorBoundary title="Could not load domains">
          <DomainsView />
        </ErrorBoundary>
      </PageShell>
    </HydrateClient>
  );
}
