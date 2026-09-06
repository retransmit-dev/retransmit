import { ErrorBoundary } from "@/components/error-boundary";
import { PageShell } from "@/components/page-shell";
import { TemplatesView } from "@/components/whatsapp/templates-view";
import { navMetadata } from "@/lib/navigation";
import { batchPrefetch, HydrateClient, trpc } from "@/trpc/server";

export const metadata = navMetadata("/whatsapp/templates");

export default function WhatsappTemplatesPage() {
  batchPrefetch([
    trpc.whatsappTemplate.list.queryOptions(),
    trpc.whatsappAccount.list.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <PageShell>
        <ErrorBoundary title="Could not load templates">
          <TemplatesView />
        </ErrorBoundary>
      </PageShell>
    </HydrateClient>
  );
}
