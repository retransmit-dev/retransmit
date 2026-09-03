"use client";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";

/** The organization the dashboard acts on, and whether the viewer runs it. */
export function useCurrentOrganization() {
  const query = useQuery(trpc.organization.current.queryOptions());
  const org = query.data;
  const canManage = org?.role === "owner" || org?.role === "admin";
  return { query, org, canManage };
}

export const fullOrganizationKey = (orgId: string | undefined) =>
  ["organization-full", orgId] as const;

/** Members and invitations, straight from better-auth. */
export function useFullOrganization(orgId: string | undefined) {
  return useQuery({
    queryKey: fullOrganizationKey(orgId),
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await authClient.organization.getFullOrganization({
        query: { organizationId: orgId! },
      });
      if (error) throw new Error(error.message ?? "Could not load the team");
      return data;
    },
  });
}
