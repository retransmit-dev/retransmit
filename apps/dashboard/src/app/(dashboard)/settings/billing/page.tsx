import { BillingView } from "@/components/settings/billing/billing-view";
import { navMetadata } from "@/lib/navigation";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = navMetadata("/settings/billing");

export default function BillingSettingsPage() {
  prefetch(trpc.billing.overview.queryOptions());
  prefetch(trpc.billing.plans.queryOptions());

  return (
    <HydrateClient>
      <BillingView />
    </HydrateClient>
  );
}
