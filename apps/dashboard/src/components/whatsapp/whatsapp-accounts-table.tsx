"use client";

import { WhatsappAccountStatusBadge } from "@/components/status-badges";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircleIcon, RefreshCwIcon } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { DisconnectNumberDialog } from "./disconnect-number-dialog";
import { QualityRating } from "./quality-rating";

export function WhatsappAccountsTable({
  connectButton,
}: {
  /** Rendered in the empty state; the header shows the same control. */
  connectButton: ReactNode;
}) {
  const queryClient = useQueryClient();
  const accounts = useQuery(trpc.whatsappAccount.list.queryOptions());
  const syncMutation = useMutation(
    trpc.whatsappAccount.sync.mutationOptions({
      onSuccess: (row) => {
        void queryClient.invalidateQueries(trpc.whatsappAccount.pathFilter());
        toast.success(`${row.phoneNumber} synced`);
      },
    }),
  );

  if (accounts.isLoading) return <TableSkeleton rows={2} />;

  if (!accounts.data || accounts.data.length === 0) {
    return (
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageCircleIcon />
          </EmptyMedia>
          <EmptyTitle>No WhatsApp number yet</EmptyTitle>
          <EmptyDescription>
            Connect and verify a number through Meta.
          </EmptyDescription>
        </EmptyHeader>
        {connectButton}
      </Empty>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden sm:table-cell">Quality</TableHead>
          <TableHead className="hidden md:table-cell">Connected</TableHead>
          <TableHead className="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {accounts.data.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="font-medium">{row.phoneNumber}</div>
              <div className="text-xs text-muted-foreground">
                {row.verifiedName ?? "No display name yet"}
                {row.source === "provisioned" && (
                  <Badge variant="outline" className="ml-2">
                    Retransmit number
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              <WhatsappAccountStatusBadge
                status={row.error ? "pending" : row.status}
              />
              {row.error && (
                <div
                  className="mt-1 max-w-xs truncate text-xs text-muted-foreground"
                  title={row.error}
                >
                  {row.error}
                </div>
              )}
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <QualityRating rating={row.qualityRating} />
            </TableCell>
            <TableCell className="hidden text-muted-foreground md:table-cell">
              {formatDate(row.createdAt)}
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Sync ${row.phoneNumber}`}
                  disabled={syncMutation.isPending}
                  onClick={() => syncMutation.mutate({ id: row.id })}
                >
                  <RefreshCwIcon className="size-4" />
                </Button>
                <DisconnectNumberDialog account={row} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
