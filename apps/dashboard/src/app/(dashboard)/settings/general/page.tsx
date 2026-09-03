import { ErrorBoundary } from "@/components/error-boundary";
import { OrganizationDetails } from "@/components/settings/general/organization-details";
import { OrganizationNameForm } from "@/components/settings/general/organization-name-form";
import { navMetadata } from "@/lib/navigation";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = navMetadata("/settings/general");

export default function GeneralSettingsPage() {
  prefetch(trpc.organization.current.queryOptions());

  return (
    <HydrateClient>
      <div className="flex flex-col gap-6">
        <ErrorBoundary title="Could not load the organization">
          <OrganizationNameForm />
        </ErrorBoundary>
        <ErrorBoundary title="Could not load the organization">
          <OrganizationDetails />
        </ErrorBoundary>
      </div>
    </HydrateClient>
  );
}
