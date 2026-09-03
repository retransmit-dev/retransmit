"use client";

import { PageHeader, PageShell } from "@/components/page-shell";
import { EmailStatusBadge } from "@/components/status-badges";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Gauge } from "@/components/ui/gauge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { LayersIcon } from "lucide-react";

/** Polls every few seconds so a running batch visibly drains. */
const LIVE_REFETCH_MS = 4000;
const LIMIT = 50;

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BatchesPage() {
  const batches = useQuery(
    trpc.email.batches.queryOptions(
      { limit: LIMIT },
      { refetchInterval: LIVE_REFETCH_MS },
    ),
  );
  const rows = batches.data ?? [];

  return (
    <PageShell>
      <PageHeader href="/batches" />

      {batches.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <Empty className="border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayersIcon />
            </EmptyMedia>
            <EmptyTitle>No batches yet</EmptyTitle>
            <EmptyDescription>
              Send more than one email in a single API call and the batch will
              show up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
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
              {rows.map((batch) => {
                const pct =
                  batch.total === 0
                    ? 0
                    : Math.round((batch.processed / batch.total) * 100);
                const statuses = Object.entries(batch.counts).filter(
                  ([, value]) => value > 0,
                );
                return (
                  <TableRow key={batch.id}>
                    <TableCell>
                      <Gauge
                        value={pct}
                        size={40}
                        label={`Batch ${batch.id} progress`}
                      >
                        <span className="text-[10px] font-medium tabular-nums">
                          {pct}%
                        </span>
                      </Gauge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{batch.id}</code>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(batch.createdAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {batch.processed.toLocaleString()} /{" "}
                      {batch.total.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {statuses.length === 0 ? (
                        <span className="text-muted-foreground">Queued</span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {statuses.map(([status, value]) => (
                            <span
                              key={status}
                              className="inline-flex items-center gap-1"
                            >
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
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </PageShell>
  );
}
