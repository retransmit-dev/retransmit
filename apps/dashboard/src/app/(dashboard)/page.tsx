import { AnalyticsView } from "@/components/analytics/analytics-view";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageShell } from "@/components/page-shell";
import { recentRange } from "@/lib/date-ranges";
import { navMetadata } from "@/lib/navigation";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = navMetadata("/");

const OVERVIEW_DAYS = 6;

export default function OverviewPage() {
  // The overview query itself needs the browser's time zone, so only the
  // domain filter is warmed up here.
  prefetch(trpc.domain.list.queryOptions());

  return (
    <HydrateClient>
      <PageShell>
        <ErrorBoundary title="Could not load the overview">
          <AnalyticsView initialRange={recentRange(OVERVIEW_DAYS)} />
        </ErrorBoundary>
      </PageShell>
    </HydrateClient>
  );
}
