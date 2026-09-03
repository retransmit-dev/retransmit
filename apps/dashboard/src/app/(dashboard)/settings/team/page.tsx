"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyIcon, MoreHorizontalIcon, SendIcon } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

type InviteRole = "member" | "admin";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export default function TeamSettingsPage() {
  const queryClient = useQueryClient();
  const org = useQuery(trpc.organization.current.queryOptions());
  const session = authClient.useSession();
  const orgId = org.data?.id;
  const canManage = org.data?.role === "owner" || org.data?.role === "admin";

  // Keep better-auth's active organization in step with the organization the
  // dashboard acts on, so its org endpoints and new sessions agree.
  useEffect(() => {
    const active = session.data?.session.activeOrganizationId;
    if (orgId && session.data && active !== orgId) {
      void authClient.organization.setActive({ organizationId: orgId });
    }
  }, [orgId, session.data]);

  const fullOrg = useQuery({
    queryKey: ["organization-full", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await authClient.organization.getFullOrganization({
        query: { organizationId: orgId! },
      });
      if (error) throw new Error(error.message ?? "Could not load the team");
      return data;
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["organization-full", orgId] });
  };

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("member");

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.organization.inviteMember({
        email: inviteEmail.trim(),
        role: inviteRole,
        organizationId: orgId!,
        resend: true,
      });
      if (error) throw new Error(error.message ?? "Could not send the invitation");
    },
    onSuccess: () => {
      refresh();
      toast.success(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
    },
    onError: (error) => toast.error(error.message),
  });

  const cancelInviteMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await authClient.organization.cancelInvitation({ invitationId });
      if (error) throw new Error(error.message ?? "Could not cancel the invitation");
    },
    onSuccess: () => {
      refresh();
      toast.success("Invitation canceled");
    },
    onError: (error) => toast.error(error.message),
  });

  const roleMutation = useMutation({
    mutationFn: async (input: { memberId: string; role: InviteRole }) => {
      const { error } = await authClient.organization.updateMemberRole({
        memberId: input.memberId,
        role: input.role,
        organizationId: orgId!,
      });
      if (error) throw new Error(error.message ?? "Could not change the role");
    },
    onSuccess: () => {
      refresh();
      toast.success("Role updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await authClient.organization.removeMember({
        memberIdOrEmail: memberId,
        organizationId: orgId!,
      });
      if (error) throw new Error(error.message ?? "Could not remove the member");
    },
    onSuccess: () => {
      refresh();
      toast.success("Member removed");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleInvite = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inviteEmail.trim()) inviteMutation.mutate();
  };

  const copyInviteLink = async (invitationId: string) => {
    await navigator.clipboard.writeText(
      `${window.location.origin}/accept-invitation/${invitationId}`,
    );
    toast.success("Invite link copied");
  };

  if (org.isLoading || fullOrg.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  const members = fullOrg.data?.members ?? [];
  const pendingInvitations = (fullOrg.data?.invitations ?? []).filter(
    (invitation) => invitation.status === "pending",
  );
  const currentUserId = session.data?.user.id;

  return (
    <div className="flex flex-col gap-6">
      {canManage && (
        <form onSubmit={handleInvite} className="flex flex-col gap-2">
          <Label htmlFor="invite-email">Invite someone to {org.data?.name}</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="invite-email"
              type="email"
              placeholder="teammate@company.com"
              className="max-w-xs"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={inviteMutation.isPending}
            />
            <div className="flex items-center gap-1">
              {(["member", "admin"] as const).map((role) => (
                <Button
                  key={role}
                  type="button"
                  size="sm"
                  variant={inviteRole === role ? "default" : "outline"}
                  className="rounded-full capitalize"
                  onClick={() => setInviteRole(role)}
                >
                  {role}
                </Button>
              ))}
            </div>
            <Button type="submit" disabled={inviteMutation.isPending || !inviteEmail.trim()}>
              {inviteMutation.isPending ? <Spinner /> : <SendIcon />}
              Invite
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Members share this organization&apos;s domains and suppression
            list. Admins can also manage them.
          </p>
        </form>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Members</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden sm:table-cell">Joined</TableHead>
              {canManage && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isSelf = member.userId === currentUserId;
              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7">
                        <AvatarImage src={member.user.image ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {initials(member.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid leading-tight">
                        <span className="font-medium">
                          {member.user.name}
                          {isSelf && (
                            <span className="text-muted-foreground"> (you)</span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {member.user.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      {!isSelf && member.role !== "owner" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Manage ${member.user.name}`}
                              />
                            }
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {member.role !== "admin" ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  roleMutation.mutate({
                                    memberId: member.id,
                                    role: "admin",
                                  })
                                }
                              >
                                Make admin
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() =>
                                  roleMutation.mutate({
                                    memberId: member.id,
                                    role: "member",
                                  })
                                }
                              >
                                Make member
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => removeMutation.mutate(member.id)}
                            >
                              Remove from organization
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {pendingInvitations.length > 0 && (
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
              {pendingInvitations.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="font-medium">{invitation.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {invitation.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {invitation.expiresAt
                      ? new Date(invitation.expiresAt).toLocaleDateString()
                      : "Never"}
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
                          onClick={() => cancelInviteMutation.mutate(invitation.id)}
                          disabled={cancelInviteMutation.isPending}
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
      )}
    </div>
  );
}
