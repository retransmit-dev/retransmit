"use client";

import { EmailStatusBadge } from "@/components/status-badges";
import { TableSkeleton } from "@/components/table-skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Gauge } from "@/components/ui/gauge";
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
import { useQuery } from "@tanstack/react-query";
import { LayersIcon } from "lucide-react";

/** Polls every few seconds so a running batch visibly drains. */
const LIVE_REFETCH_MS = 4000;

export function BatchesTable() {
  const batches = useQuery(
    trpc.email.batches.queryOptions(
      { limit: BATCHES_LIMIT },
      { refetchInterval: LIVE_REFETCH_MS },
    ),
  );
  const rows = batches.data ?? [];

  if (batches.isLoading) return <TableSkeleton />;

  if (rows.length === 0) {
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
  );
}

type Batch = RouterOutputs["email"]["batches"][number];

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
