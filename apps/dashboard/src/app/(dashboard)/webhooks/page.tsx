import { PageShell } from "@/components/page-shell";
import { WebhooksView } from "@/components/webhooks/webhooks-view";
import { navMetadata } from "@/lib/navigation";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = navMetadata("/webhooks");

export default function WebhooksPage() {
  prefetch(trpc.webhook.list.queryOptions());

  return (
    <HydrateClient>
      <PageShell>
        <WebhooksView />
      </PageShell>
    </HydrateClient>
  );
}
