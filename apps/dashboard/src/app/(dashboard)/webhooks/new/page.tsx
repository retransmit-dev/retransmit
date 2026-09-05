import { PageShell } from "@/components/page-shell";
import { NewEndpointView } from "@/components/webhooks/new-endpoint-view";
import { navMetadata } from "@/lib/navigation";

export const metadata = navMetadata("/webhooks/new");

export default function NewWebhookPage() {
  return (
    <PageShell>
      <NewEndpointView />
    </PageShell>
  );
}
