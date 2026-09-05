"use client";

import { WebhookEndpointStatusBadge } from "@/components/status-badges";
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
import Link from "next/link";
import { useRouter } from "next/navigation";

import { DeleteEndpointDialog } from "./delete-endpoint-dialog";
import { channelCounts } from "./event-types";

export function WebhooksTable() {
  const router = useRouter();
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
            Get email, SMS, and WhatsApp events at a URL.
          </EmptyDescription>
        </EmptyHeader>
        <Button nativeButton={false} render={<Link href="/webhooks/new" />}>
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
            onClick={() => router.push(`/webhooks/${row.id}`)}
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
              <WebhookEndpointStatusBadge enabled={row.enabled} />
            </TableCell>
            <TableCell className="hidden text-muted-foreground sm:table-cell">
              {formatDate(row.createdAt)}
            </TableCell>
            <TableCell
              className="flex justify-end"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-end gap-1">
                {/* <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/webhooks/${row.id}`} />}
                >
                  Details
                </Button> */}
                <DeleteEndpointDialog endpoint={row} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
