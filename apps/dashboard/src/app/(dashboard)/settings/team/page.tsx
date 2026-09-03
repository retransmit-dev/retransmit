import { TeamView } from "@/components/settings/team/team-view";
import { navMetadata } from "@/lib/navigation";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = navMetadata("/settings/team");

export default function TeamSettingsPage() {
  prefetch(trpc.organization.current.queryOptions());

  return (
    <HydrateClient>
      <TeamView />
    </HydrateClient>
  );
}
