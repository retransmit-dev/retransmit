"use client";

import { authClient } from "@/lib/auth-client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Makes another workspace the active one and re-renders everything against it.
 *
 * Every cached query belongs to the workspace that was active when it ran,
 * and none of the keys say which one that was. So the cache is reset, not
 * invalidated: mounted screens refetch against the new workspace instead of
 * showing the old one's data until it goes stale, and the server tree is
 * refreshed for the same reason.
 *
 * Shared by the sidebar's workspace card and the paywall, which has to offer
 * a way to a subscribed workspace while the sidebar is out of reach.
 */
export function useSwitchWorkspace(activeWorkspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [switchingTo, setSwitchingTo] = useState<string>();

  async function switchWorkspace(organizationId: string) {
    if (organizationId === activeWorkspaceId || switchingTo) return;
    setSwitchingTo(organizationId);
    try {
      const { error } = await authClient.organization.setActive({
        organizationId,
      });
      if (error) throw new Error(error.message);
      await queryClient.resetQueries();
      router.refresh();
    } catch {
      toast.error("Workspace switch failed. Try again.");
    } finally {
      setSwitchingTo(undefined);
    }
  }

  return { switchWorkspace, switchingTo };
}
