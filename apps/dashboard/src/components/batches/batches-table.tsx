"use client";

import { EmailStatusBadge } from "@/components/status-badges";
import { TableSkeleton } from "@/components/table-skeleton";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Gauge } from "@/components/ui/gauge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RouterOutputs } from "@/lib/api-types";
import { BATCHES_LIMIT } from "@/lib/batches";
import { formatDateTime } from "@/lib/format";
import { trpc } from "@/utils/trpc";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon, LayersIcon } from "lucide-react";
import { useState } from "react";

/** Polls every few seconds so a running batch visibly drains. */
const LIVE_REFETCH_MS = 4000;

export function BatchesTable() {
  /** Stack of page cursors; the last entry is the current page's cursor. */
  const [cursors, setCursors] = useState<Date[]>([]);
  const batches = useQuery(
    trpc.email.batches.queryOptions(
      { limit: BATCHES_LIMIT, cursor: cursors[cursors.length - 1] },
      { refetchInterval: LIVE_REFETCH_MS, placeholderData: keepPreviousData },
    ),
  );
  const rows = batches.data?.items ?? [];
  const nextCursor = batches.data?.nextCursor;

  if (batches.isLoading) return <TableSkeleton />;

  if (rows.length === 0 && cursors.length === 0) {
    return (
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LayersIcon />
          </EmptyMedia>
          <EmptyTitle>No batches yet</EmptyTitle>
          <EmptyDescription>
            Batches appear after a bulk API send.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Progress</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Processed</TableHead>
              <TableHead>Statuses</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((batch) => (
              <BatchRow key={batch.id} batch={batch} />
            ))}
          </TableBody>
        </Table>
      </div>

      {(cursors.length > 0 || nextCursor) && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="outline"
                size="sm"
                disabled={cursors.length === 0 || batches.isPlaceholderData}
                onClick={() => setCursors((stack) => stack.slice(0, -1))}
              >
                <ChevronLeftIcon />
                Previous
              </Button>
            </PaginationItem>
            <PaginationItem>
              <span className="px-2 text-sm text-muted-foreground">
                Page {cursors.length + 1}
              </span>
            </PaginationItem>
            <PaginationItem>
              <Button
                variant="outline"
                size="sm"
                disabled={!nextCursor || batches.isPlaceholderData}
                onClick={() =>
                  nextCursor &&
                  setCursors((stack) => [...stack, new Date(nextCursor)])
                }
              >
                Next
                <ChevronRightIcon />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </>
  );
}

type Batch = RouterOutputs["email"]["batches"]["items"][number];

function BatchRow({ batch }: { batch: Batch }) {
  const pct =
    batch.total === 0 ? 0 : Math.round((batch.processed / batch.total) * 100);
  const statuses = Object.entries(batch.counts).filter(([, value]) => value > 0);

  return (
    <TableRow>
      <TableCell>
        <Gauge value={pct} size={40} label={`Batch ${batch.id} progress`}>
          <span className="text-[10px] font-medium tabular-nums">{pct}%</span>
        </Gauge>
      </TableCell>
      <TableCell>
        <code className="text-xs">{batch.id}</code>
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {formatDateTime(batch.createdAt)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-right tabular-nums">
        {batch.processed.toLocaleString()} / {batch.total.toLocaleString()}
      </TableCell>
      <TableCell>
        {statuses.length === 0 ? (
          <span className="text-muted-foreground">Queued</span>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {statuses.map(([status, value]) => (
              <span key={status} className="inline-flex items-center gap-1">
                <EmailStatusBadge status={status} />
                <span className="text-xs tabular-nums text-muted-foreground">
                  {value.toLocaleString()}
                </span>
              </span>
            ))}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
