"use client";

import { SmsSenderStatusBadge } from "@/components/status-badges";
import { TableSkeleton } from "@/components/table-skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { useCountryLookup } from "@/lib/sms-countries";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, SignatureIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

function CountryChips({ codes }: { codes: string[] }) {
  const countryName = useCountryLookup();
  if (codes.length === 0) return <span className="text-muted-foreground">—</span>;
  // Three is what fits on one line at the narrowest column width; the rest
  // stay reachable as a count rather than wrapping the row.
  const shown = codes.slice(0, 3);
  const rest = codes.length - shown.length;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((code) => (
        <Badge key={code} variant="secondary" className="font-normal">
          {countryName(code)}
        </Badge>
      ))}
      {rest > 0 && (
        <Badge variant="secondary" className="font-normal" title={codes.join(", ")}>
          +{rest}
        </Badge>
      )}
    </span>
  );
}

export function SendersTable({ onRequest }: { onRequest: () => void }) {
  const queryClient = useQueryClient();
  const senders = useQuery(trpc.smsSender.list.queryOptions());

  const deleteMutation = useMutation(
    trpc.smsSender.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.smsSender.pathFilter());
        toast.success("Sender id removed");
      },
    }),
  );

  if (senders.isLoading) return <TableSkeleton rows={2} />;

  if (!senders.data || senders.data.length === 0) {
    return (
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SignatureIcon />
          </EmptyMedia>
          <EmptyTitle>No sender ids yet</EmptyTitle>
          <EmptyDescription>
            Until one is approved, messages go out under a shared default and may not reach every
            country.
          </EmptyDescription>
        </EmptyHeader>
        <Button onClick={onRequest}>
          <PlusIcon />
          Request sender id
        </Button>
      </Empty>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sender id</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden sm:table-cell">Countries</TableHead>
          <TableHead className="hidden md:table-cell">Requested</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {senders.data.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">
              <span className="font-mono">{row.senderId}</span>
              {/* A rejection is only actionable if the reason is visible. */}
              {row.status === "rejected" && row.reviewNote && (
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  {row.reviewNote}
                </span>
              )}
            </TableCell>
            <TableCell>
              <SmsSenderStatusBadge status={row.status} />
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <CountryChips codes={row.countries} />
            </TableCell>
            <TableCell className="hidden text-muted-foreground md:table-cell">
              {formatDate(row.createdAt)}
            </TableCell>
            <TableCell>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="ghost" size="icon" aria-label={`Remove ${row.senderId}`}>
                      <Trash2Icon />
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove {row.senderId}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {row.status === "approved"
                        ? "Messages to these countries will fall back to the shared default sender, and the carrier registration is released."
                        : "The request is withdrawn. You can request the same name again later."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate({ id: row.id })}
                      disabled={deleteMutation.isPending}
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
