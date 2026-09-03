import { ApiKeysTable } from "@/components/api-keys/api-keys-table";
import { CreateApiKeyButton } from "@/components/api-keys/create-api-key-button";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageHeader, PageShell } from "@/components/page-shell";
import { navMetadata } from "@/lib/navigation";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = navMetadata("/api-keys");

export default function ApiKeysPage() {
  prefetch(trpc.apiKey.list.queryOptions());

  return (
    <HydrateClient>
      <PageShell>
        <PageHeader href="/api-keys" actions={<CreateApiKeyButton />} />
        <ErrorBoundary title="Could not load API keys">
          <ApiKeysTable />
        </ErrorBoundary>
      </PageShell>
    </HydrateClient>
  );
}
