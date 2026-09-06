import { ErrorBoundary } from "@/components/error-boundary";
import { PageShell } from "@/components/page-shell";
import { SmsView } from "@/components/sms/sms-view";
import { recentRange } from "@/lib/date-ranges";
import { navMetadata } from "@/lib/navigation";
import { SMS_DEFAULT_DAYS, SMS_PAGE_SIZE } from "@/lib/sms";
import { batchPrefetch, HydrateClient, trpc } from "@/trpc/server";

export const metadata = navMetadata("/sms");

export default function SmsPage() {
  // Computed here and handed down so the first query in the browser matches
  // the one started on the server, down to the millisecond.
  const range = recentRange(SMS_DEFAULT_DAYS);
  batchPrefetch([
    trpc.apiKey.list.queryOptions(),
    trpc.sms.providers.queryOptions(),
    trpc.sms.list.queryOptions({
      limit: SMS_PAGE_SIZE,
      from: range.from,
      to: range.to,
    }),
  ]);

  return (
    <HydrateClient>
      <PageShell>
        <ErrorBoundary title="Could not load SMS">
          <SmsView initialRange={range} />
        </ErrorBoundary>
      </PageShell>
    </HydrateClient>
  );
}
