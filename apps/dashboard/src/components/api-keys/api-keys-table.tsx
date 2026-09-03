"use client";

import { TableSkeleton } from "@/components/table-skeleton";
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
import { KeyRoundIcon } from "lucide-react";

import { CreateApiKeyButton } from "./create-api-key-button";
import { RevokeApiKeyDialog } from "./revoke-api-key-dialog";

export function ApiKeysTable() {
  const keys = useQuery(trpc.apiKey.list.queryOptions());

  if (keys.isLoading) return <TableSkeleton rows={2} />;

  if (!keys.data || keys.data.length === 0) {
    return (
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <KeyRoundIcon />
          </EmptyMedia>
          <EmptyTitle>No API keys yet</EmptyTitle>
          <EmptyDescription>
            Send a key as{" "}
            <code className="font-mono text-xs">Authorization: Bearer rt_...</code>{" "}
            in API requests.
          </EmptyDescription>
        </EmptyHeader>
        <CreateApiKeyButton />
      </Empty>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Key</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden sm:table-cell">Created</TableHead>
          <TableHead className="hidden sm:table-cell">Last used</TableHead>
          <TableHead className="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {keys.data.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell>
              <code className="font-mono text-xs text-muted-foreground">
                {row.keyHint}
              </code>
            </TableCell>
            <TableCell>
              {row.revokedAt ? (
                <Badge variant="destructive">Revoked</Badge>
              ) : (
                <Badge variant="outline">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Active
                </Badge>
              )}
            </TableCell>
            <TableCell className="hidden text-muted-foreground sm:table-cell">
              {formatDate(row.createdAt)}
            </TableCell>
            <TableCell className="hidden text-muted-foreground sm:table-cell">
              {row.lastUsedAt ? formatDateTime(row.lastUsedAt) : "Never"}
            </TableCell>
            <TableCell>
              {!row.revokedAt && <RevokeApiKeyDialog apiKey={row} />}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
