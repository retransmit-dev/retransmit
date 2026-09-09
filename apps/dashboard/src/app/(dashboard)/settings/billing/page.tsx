import { BillingView } from "@/components/settings/billing/billing-view";
import { navMetadata } from "@/lib/navigation";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { isCloudMode } from "@retransmit/billing/mode";
import { notFound } from "next/navigation";

export const metadata = navMetadata("/settings/billing");

export default function BillingSettingsPage() {
  if (!isCloudMode()) notFound();

  prefetch(trpc.billing.overview.queryOptions());
  prefetch(trpc.billing.plans.queryOptions());

  return (
    <HydrateClient>
      <BillingView />
    </HydrateClient>
  );
}
