"use client";

import { SuppressionReasonBadge } from "@/components/status-badges";
import { TableSkeleton } from "@/components/table-skeleton";
import { Button } from "@/components/ui/button";
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
import { useCurrentOrganization } from "@/hooks/use-organization";
import { formatDate } from "@/lib/format";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BanIcon, Trash2Icon } from "lucide-react";
import { useDeferredValue } from "react";
import { toast } from "sonner";

import type { SuppressionFilters } from "./suppression-filters";

export function SuppressionsTable({ filters }: { filters: SuppressionFilters }) {
  const queryClient = useQueryClient();
  const search = useDeferredValue(filters.search);
  const { canManage } = useCurrentOrganization();
  const stats = useQuery(trpc.suppression.stats.queryOptions());
  const list = useQuery(
    trpc.suppression.list.queryOptions({
      search: search || undefined,
      reason: filters.reason ?? undefined,
    }),
  );

  const removeMutation = useMutation(
    trpc.suppression.remove.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.suppression.pathFilter());
        toast.success("Removed. The address is sendable again.");
      },
    }),
  );

  const hasAny = (stats.data?.total ?? 0) > 0;
  const rows = list.data?.rows ?? [];

  if (list.isLoading || stats.isLoading) return <TableSkeleton rows={2} />;

  if (rows.length === 0) {
    return (
      <Empty className="rounded-lg border border-dashed py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BanIcon />
          </EmptyMedia>
          <EmptyTitle>{hasAny ? "No matches" : "No suppressions yet"}</EmptyTitle>
          <EmptyDescription>
            {hasAny
              ? "No matches for this search or filter."
              : "Bounces and complaints are added automatically. Import existing suppressions here."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Address</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead className="hidden sm:table-cell">Added</TableHead>
            {canManage && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.email}</TableCell>
              <TableCell>
                <SuppressionReasonBadge reason={row.reason} />
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {formatDate(row.createdAt)}
              </TableCell>
              {canManage && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${row.email} from suppressions`}
                    onClick={() => removeMutation.mutate({ ids: [row.id] })}
                    disabled={removeMutation.isPending}
                  >
                    <Trash2Icon className="size-4 text-destructive" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {list.data && list.data.total > rows.length && (
        <p className="text-sm text-muted-foreground">
          Latest {rows.length} of {list.data.total}. Search or export for all.
        </p>
      )}
    </>
  );
}
