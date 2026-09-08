import { SmsSenderQueue } from "@/components/admin/sms-sender-queue";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageHeader } from "@/components/page-shell";
import { navMetadata } from "@/lib/navigation";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = navMetadata("/admin/senders");

export default function AdminSendersPage() {
  prefetch(trpc.smsSender.queue.queryOptions());

  return (
    <HydrateClient>
      <PageHeader
        href="/admin/senders"
        level={2}
        description="Register the approved ones upstream, then record the outcome here. Approving is what lets an organization send with the name."
      />
      <ErrorBoundary title="Could not load sender ID requests">
        <SmsSenderQueue />
      </ErrorBoundary>
    </HydrateClient>
  );
}
