import { ErrorBoundary } from "@/components/error-boundary";
import { PageHeader, PageShell } from "@/components/page-shell";
import { SuppressionStats } from "@/components/suppressions/suppression-stats";
import { SuppressionsView } from "@/components/suppressions/suppressions-view";
import { navMetadata } from "@/lib/navigation";
import { SUPPRESSIONS_PAGE_SIZE } from "@/lib/suppressions";
import { batchPrefetch, HydrateClient, trpc } from "@/trpc/server";

export const metadata = navMetadata("/suppressions");

export default function SuppressionsPage() {
  batchPrefetch([
    trpc.organization.current.queryOptions(),
    trpc.suppression.stats.queryOptions(),
    trpc.suppression.list.queryOptions({
      limit: SUPPRESSIONS_PAGE_SIZE,
      offset: 0,
    }),
  ]);

  return (
    <HydrateClient>
      <PageShell>
        <PageHeader href="/suppressions" />
        <ErrorBoundary title="Could not load suppression counts">
          <SuppressionStats />
        </ErrorBoundary>
        <ErrorBoundary title="Could not load suppressions">
          <SuppressionsView />
        </ErrorBoundary>
      </PageShell>
    </HydrateClient>
  );
}
