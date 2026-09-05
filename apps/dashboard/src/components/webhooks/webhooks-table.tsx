"use client";

import { StatusDot } from "@/components/status-badges";
import { TableSkeleton } from "@/components/table-skeleton";
import { Badge } from "@/components/ui/badge";
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
import { formatDate } from "@/lib/format";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon, WebhookIcon } from "lucide-react";

import { DeleteEndpointDialog } from "./delete-endpoint-dialog";
import { channelCounts } from "./event-types";

export function WebhookEnabledBadge({ enabled }: { enabled: boolean }) {
  return (
    <Badge variant="outline">
      <StatusDot className={enabled ? "bg-emerald-500" : "bg-zinc-400"} />
      {enabled ? "Enabled" : "Disabled"}
    </Badge>
  );
}

export function WebhooksTable({
  onSelect,
  onAdd,
}: {
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const endpoints = useQuery(trpc.webhook.list.queryOptions());

  if (endpoints.isLoading) return <TableSkeleton rows={2} />;

  if (!endpoints.data || endpoints.data.length === 0) {
    return (
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WebhookIcon />
          </EmptyMedia>
          <EmptyTitle>No endpoints yet</EmptyTitle>
          <EmptyDescription>
            Add a URL and pick the events it receives. One endpoint and one signing secret
            cover email, SMS, and WhatsApp.
          </EmptyDescription>
        </EmptyHeader>
        <Button onClick={onAdd}>
          <PlusIcon />
          Add endpoint
        </Button>
      </Empty>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Endpoint</TableHead>
          <TableHead>Events</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden sm:table-cell">Created</TableHead>
          <TableHead className="w-24" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {endpoints.data.map((row) => (
          <TableRow
            key={row.id}
            className="cursor-pointer"
            onClick={() => onSelect(row.id)}
          >
            <TableCell className="max-w-xs">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{row.url}</span>
                <code className="truncate font-mono text-xs text-muted-foreground">
                  {row.id}
                </code>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {channelCounts(row.eventTypes).map((channel) => (
                  <Badge key={channel.id} variant="secondary">
                    {channel.label}
                    <span className="text-muted-foreground">
                      {channel.selected}/{channel.total}
                    </span>
                  </Badge>
                ))}
              </div>
            </TableCell>
            <TableCell>
              <WebhookEnabledBadge enabled={row.enabled} />
            </TableCell>
            <TableCell className="hidden text-muted-foreground sm:table-cell">
              {formatDate(row.createdAt)}
            </TableCell>
            <TableCell onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => onSelect(row.id)}>
                  Details
                </Button>
                <DeleteEndpointDialog endpoint={row} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
