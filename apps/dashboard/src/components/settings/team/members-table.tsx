"use client";

import { TableSkeleton } from "@/components/table-skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { MoreHorizontalIcon } from "lucide-react";
import { toast } from "sonner";

type MemberRole = "member" | "admin";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function MembersTable() {
  const queryClient = useQueryClient();
  const { org, canManage, query: orgQuery } = useCurrentOrganization();
  const fullOrg = useFullOrganization(org?.id);
  const session = authClient.useSession();
  const currentUserId = session.data?.user.id;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: fullOrganizationKey(org?.id) });
  };

  const roleMutation = useMutation({
    mutationFn: async (input: { memberId: string; role: MemberRole }) => {
      const { error } = await authClient.organization.updateMemberRole({
        memberId: input.memberId,
        role: input.role,
        organizationId: org!.id,
      });
      if (error) throw new Error(error.message ?? "Could not change the role");
    },
    onSuccess: () => {
      refresh();
      toast.success("Role updated");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await authClient.organization.removeMember({
        memberIdOrEmail: memberId,
        organizationId: org!.id,
      });
      if (error) throw new Error(error.message ?? "Could not remove the member");
    },
    onSuccess: () => {
      refresh();
      toast.success("Member removed");
    },
  });

  if (orgQuery.isLoading || fullOrg.isLoading) return <TableSkeleton rows={2} />;

  const members = fullOrg.data?.members ?? [];

  return (
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
                  {formatDate(member.createdAt)}
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
                          <DropdownMenuItem
                            onClick={() =>
                              roleMutation.mutate({
                                memberId: member.id,
                                role: member.role === "admin" ? "member" : "admin",
                              })
                            }
                          >
                            {member.role === "admin" ? "Make member" : "Make admin"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => removeMutation.mutate(member.id)}
                          >
                            Remove member
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
  );
}
