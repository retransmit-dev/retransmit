"use client";

import { TableSkeleton } from "@/components/table-skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/format";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { UsersRoundIcon } from "lucide-react";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** Every registered user, most recently seen first. */
export function UsersTable() {
  const users = useQuery(
    trpc.admin.users.queryOptions(undefined, { throwOnError: true }),
  );

  if (users.isLoading) return <TableSkeleton rows={3} />;

  const rows = users.data ?? [];

  if (rows.length === 0) {
    return (
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UsersRoundIcon />
          </EmptyMedia>
          <EmptyTitle>No users yet</EmptyTitle>
          <EmptyDescription>
            Accounts appear here as soon as someone signs in.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {rows.length} {rows.length === 1 ? "user" : "users"}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Last connection</TableHead>
            <TableHead className="hidden sm:table-cell">Signed up</TableHead>
            <TableHead className="hidden text-right md:table-cell">
              Active sessions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="size-7">
                    <AvatarImage src={row.image ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {initials(row.name || row.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid leading-tight">
                    <span className="font-medium">
                      {row.name || row.email}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {row.email}
                      {!row.emailVerified && (
                        <Badge variant="outline" className="ml-2 align-middle">
                          Unverified
                        </Badge>
                      )}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {row.lastSeenAt ? (
                  <time dateTime={new Date(row.lastSeenAt).toISOString()}>
                    {formatDateTime(row.lastSeenAt)}
                  </time>
                ) : (
                  "Never"
                )}
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {formatDate(row.createdAt)}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">
                {row.activeSessions}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
