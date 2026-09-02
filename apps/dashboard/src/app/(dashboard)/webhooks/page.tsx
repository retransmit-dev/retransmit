import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { WebhookIcon } from "lucide-react";

export default function WebhooksPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Webhooks</h1>
        <p className="text-sm text-muted-foreground">
          Get notified about deliveries, bounces, and complaints.
        </p>
      </div>
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WebhookIcon />
          </EmptyMedia>
          <EmptyTitle>Coming soon</EmptyTitle>
          <EmptyDescription>
            Managing webhook endpoints from the dashboard is on its way.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
