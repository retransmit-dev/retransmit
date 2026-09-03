"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fullOrganizationKey,
  useCurrentOrganization,
  useFullOrganization,
} from "@/hooks/use-organization";
import { authClient } from "@/lib/auth-client";
import { formatDate } from "@/lib/format";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

/** Invitations not yet accepted. Renders nothing when there are none. */
export function PendingInvitations() {
  const queryClient = useQueryClient();
  const { org, canManage } = useCurrentOrganization();
  const fullOrg = useFullOrganization(org?.id);

  const cancelMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await authClient.organization.cancelInvitation({
        invitationId,
      });
      if (error) throw new Error(error.message ?? "Could not cancel the invitation");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fullOrganizationKey(org?.id) });
      toast.success("Invitation canceled");
    },
  });

  const copyInviteLink = async (invitationId: string) => {
    await navigator.clipboard.writeText(
      `${window.location.origin}/accept-invitation/${invitationId}`,
    );
    toast.success("Invite link copied");
  };

  const pending = (fullOrg.data?.invitations ?? []).filter(
    (invitation) => invitation.status === "pending",
  );
  if (pending.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">Pending invitations</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="hidden sm:table-cell">Expires</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pending.map((invitation) => (
            <TableRow key={invitation.id}>
              <TableCell className="font-medium">{invitation.email}</TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {invitation.role}
                </Badge>
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {invitation.expiresAt ? formatDate(invitation.expiresAt) : "Never"}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Copy invite link"
                    onClick={() => void copyInviteLink(invitation.id)}
                  >
                    <CopyIcon className="size-4" />
                  </Button>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelMutation.mutate(invitation.id)}
                      disabled={cancelMutation.isPending}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
