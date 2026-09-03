import { PageHeader, PageShell } from "@/components/page-shell";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { navMetadata } from "@/lib/navigation";
import { WebhookIcon } from "lucide-react";

export const metadata = navMetadata("/webhooks");

export default function WebhooksPage() {
  return (
    <PageShell>
      <PageHeader href="/webhooks" />
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WebhookIcon />
          </EmptyMedia>
          <EmptyTitle>Coming soon</EmptyTitle>
          <EmptyDescription>Webhook management is coming soon.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </PageShell>
  );
}
