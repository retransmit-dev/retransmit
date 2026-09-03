"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { authClient } from "@/lib/auth-client";
import { useEffect } from "react";

import { InviteForm } from "./invite-form";
import { MembersTable } from "./members-table";
import { PendingInvitations } from "./pending-invitations";

export function TeamView() {
  const { org } = useCurrentOrganization();
  const session = authClient.useSession();
  const orgId = org?.id;

  // Keep better-auth's active organization in step with the organization the
  // dashboard acts on, so its org endpoints and new sessions agree.
  useEffect(() => {
    const active = session.data?.session.activeOrganizationId;
    if (orgId && session.data && active !== orgId) {
      void authClient.organization.setActive({ organizationId: orgId });
    }
  }, [orgId, session.data]);

  return (
    <div className="flex flex-col gap-6">
      <ErrorBoundary title="Could not load the invite form">
        <InviteForm />
      </ErrorBoundary>
      <ErrorBoundary title="Could not load members">
        <MembersTable />
      </ErrorBoundary>
      <ErrorBoundary title="Could not load invitations">
        <PendingInvitations />
      </ErrorBoundary>
    </div>
  );
}
