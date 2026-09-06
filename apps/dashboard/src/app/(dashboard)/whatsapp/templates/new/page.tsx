import { ErrorBoundary } from "@/components/error-boundary";
import { PageShell } from "@/components/page-shell";
import { NewTemplateView } from "@/components/whatsapp/new-template-view";
import { navMetadata } from "@/lib/navigation";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = navMetadata("/whatsapp/templates/new");

export default function NewWhatsappTemplatePage() {
  prefetch(trpc.whatsappAccount.list.queryOptions());

  return (
    <HydrateClient>
      <PageShell>
        <ErrorBoundary title="Could not load the template editor">
          <NewTemplateView />
        </ErrorBoundary>
      </PageShell>
    </HydrateClient>
  );
}
