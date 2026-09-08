import { WhatsappRatesTable } from "@/components/admin/whatsapp-rates";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageHeader } from "@/components/page-shell";
import { navMetadata } from "@/lib/navigation";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = navMetadata("/admin/whatsapp-rates");

export default function AdminWhatsappRatesPage() {
  prefetch(trpc.admin.whatsappRates.queryOptions());

  return (
    <HydrateClient>
      <PageHeader
        href="/admin/whatsapp-rates"
        level={2}
        description="Per destination and category, since Meta prices marketing and authentication very differently. Anything without an override bills at the category default."
      />
      <ErrorBoundary title="Could not load WhatsApp rates">
        <WhatsappRatesTable />
      </ErrorBoundary>
    </HydrateClient>
  );
}
