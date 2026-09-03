import { EmailsView } from "@/components/emails/emails-view";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageHeader, PageShell } from "@/components/page-shell";
import { recentRange } from "@/lib/date-ranges";
import { EMAILS_DEFAULT_DAYS, EMAILS_PAGE_SIZE } from "@/lib/emails";
import { navMetadata } from "@/lib/navigation";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = navMetadata("/emails");

export default function EmailsPage() {
  // Computed here and handed down so the first query in the browser matches
  // the one started on the server, down to the millisecond.
  const range = recentRange(EMAILS_DEFAULT_DAYS);
  prefetch(trpc.apiKey.list.queryOptions());
  prefetch(
    trpc.email.list.queryOptions({
      limit: EMAILS_PAGE_SIZE,
      from: range.from,
      to: range.to,
    }),
  );

  return (
    <HydrateClient>
      <PageShell>
        <PageHeader href="/emails" />
        {/* <LiveStats /> (components/emails/live-stats) stays out until the
            counts follow the date range. */}
        <ErrorBoundary title="Could not load emails">
          <EmailsView initialRange={range} />
        </ErrorBoundary>
      </PageShell>
    </HydrateClient>
  );
}
