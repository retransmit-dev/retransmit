import { BatchesTable } from "@/components/batches/batches-table";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageHeader, PageShell } from "@/components/page-shell";
import { BATCHES_LIMIT } from "@/lib/batches";
import { navMetadata } from "@/lib/navigation";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = navMetadata("/batches");

export default function BatchesPage() {
  prefetch(trpc.email.batches.queryOptions({ limit: BATCHES_LIMIT }));

  return (
    <HydrateClient>
      <PageShell>
        <PageHeader href="/batches" />
        <ErrorBoundary title="Could not load batches">
          <BatchesTable />
        </ErrorBoundary>
      </PageShell>
    </HydrateClient>
  );
}
