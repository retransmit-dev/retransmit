import { ErrorBoundary } from "@/components/error-boundary";
import { PageShell } from "@/components/page-shell";
import { EndpointDetailsView } from "@/components/webhooks/endpoint-details-view";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Webhook endpoint",
  description: "Events, signing secret, and delivery log for one endpoint.",
};

export default async function WebhookEndpointPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  prefetch(trpc.webhook.get.queryOptions({ id }));
  prefetch(trpc.webhook.deliveries.queryOptions({ endpointId: id, limit: 50 }));

  return (
    <HydrateClient>
      <PageShell>
        <ErrorBoundary title="Could not load this endpoint">
          <EndpointDetailsView endpointId={id} />
        </ErrorBoundary>
      </PageShell>
    </HydrateClient>
  );
}
