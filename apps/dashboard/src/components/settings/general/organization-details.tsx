"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrganization } from "@/hooks/use-organization";

/** Read-only facts about the organization: its slug and the viewer's role. */
export function OrganizationDetails() {
  const { org, query } = useCurrentOrganization();

  if (query.isLoading) return <Skeleton className="h-16 w-full max-w-lg" />;
  if (!org) return null;

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Slug</span>
        <code className="font-mono">{org.slug}</code>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Your role</span>
        <span className="capitalize">{org.role}</span>
      </div>
    </div>
  );
}
