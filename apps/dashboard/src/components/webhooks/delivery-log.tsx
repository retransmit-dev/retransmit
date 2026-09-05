"use client";

import { StatusDot } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { RouterOutputs } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, RefreshCwIcon } from "lucide-react";
import { Fragment, useState } from "react";

import { eventLabel } from "./event-types";

type Delivery = RouterOutputs["webhook"]["deliveries"][number];

/** Every attempt at an endpoint, newest first. A row expands to its payload. */
export function DeliveryLog({ endpointId }: { endpointId: string }) {
  const deliveries = useQuery(trpc.webhook.deliveries.queryOptions({ endpointId, limit: 50 }));
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex h-8 items-center justify-between gap-3">
        <h2 className="font-medium">Deliveries</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void deliveries.refetch()}
          disabled={deliveries.isFetching}
        >
          {deliveries.isFetching ? <Spinner /> : <RefreshCwIcon />}
          Refresh
        </Button>
      </div>

      {deliveries.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : !deliveries.data || deliveries.data.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No deliveries yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Response</TableHead>
              <TableHead>Event</TableHead>
              <TableHead className="hidden sm:table-cell">ID</TableHead>
              <TableHead>Time</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries.data.map((delivery) => (
              <DeliveryRows
                key={delivery.id}
                delivery={delivery}
                expanded={expandedId === delivery.id}
                onToggle={() =>
                  setExpandedId((current) => (current === delivery.id ? null : delivery.id))
                }
              />
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function DeliveryRows({
  delivery,
  expanded,
  onToggle,
}: {
  delivery: Delivery;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Fragment>
      <TableRow className="cursor-pointer" onClick={onToggle} aria-expanded={expanded}>
        <TableCell>
          <Badge variant="outline">
            <StatusDot className={delivery.success ? "bg-emerald-500" : "bg-red-500"} />
            {delivery.responseStatus ?? "No response"}
          </Badge>
        </TableCell>
        <TableCell className="font-medium">{eventLabel(delivery.eventType)}</TableCell>
        <TableCell className="hidden sm:table-cell">
          <code className="font-mono text-xs text-muted-foreground">{delivery.id}</code>
        </TableCell>
        <TableCell className="text-muted-foreground">
          {formatDateTime(delivery.createdAt)}
        </TableCell>
        <TableCell>
          <ChevronDownIcon
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={5} className="bg-muted/30 p-3">
            <div className="flex flex-col gap-2">
              {delivery.error && (
                <p className="text-xs text-destructive">{delivery.error}</p>
              )}
              <pre className="max-h-80 overflow-auto font-mono text-xs">
                {JSON.stringify(delivery.payload, null, 2)}
              </pre>
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}
