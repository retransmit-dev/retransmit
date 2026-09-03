import { ErrorBoundary } from "@/components/error-boundary";
import { PageShell } from "@/components/page-shell";
import { WhatsappView } from "@/components/whatsapp/whatsapp-view";
import { navMetadata } from "@/lib/navigation";
import { batchPrefetch, HydrateClient, trpc } from "@/trpc/server";

export const metadata = navMetadata("/whatsapp");

export default function WhatsappPage() {
  batchPrefetch([
    trpc.whatsappAccount.signupConfig.queryOptions(),
    trpc.whatsappAccount.list.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <PageShell>
        <ErrorBoundary title="Could not load WhatsApp">
          <WhatsappView />
        </ErrorBoundary>
      </PageShell>
    </HydrateClient>
  );
}
