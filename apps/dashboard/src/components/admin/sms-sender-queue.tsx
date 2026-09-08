"use client";

import { SmsSenderStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import type { RouterOutputs } from "@/lib/api-types";
import { formatDate } from "@/lib/format";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, InboxIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type QueueRow = RouterOutputs["smsSender"]["queue"][number];

/**
 * The operator side of a sender id request: everything a carrier registration
 * form asks for, in one row, and the two buttons that decide it. Approving is
 * what makes the name usable for sending, so the dialog asks for the upstream
 * registration reference at the same time — an approval with nothing filed
 * behind it is how a sender id ends up working here and failing at the
 * carrier.
 */
export function SmsSenderQueue() {
  const queue = useQuery(trpc.smsSender.queue.queryOptions(undefined, { throwOnError: true }));
  const [reviewing, setReviewing] = useState<{ row: QueueRow; approve: boolean } | null>(null);

  if (queue.isLoading) {
    return (
      <div className="grid gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!queue.data || queue.data.length === 0) {
    return (
      <Empty className="border py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <InboxIcon />
          </EmptyMedia>
          <EmptyTitle>No sender id requests</EmptyTitle>
          <EmptyDescription>Requests from every organization land here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sender id</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead className="hidden lg:table-cell">Countries</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Requested</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {queue.data.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono font-medium">
                {row.senderId}
                <span className="mt-0.5 block max-w-xs truncate font-sans text-xs font-normal text-muted-foreground">
                  {row.useCase ?? "No filing details — destinations take the name as-is"}
                </span>
              </TableCell>
              <TableCell>
                {row.organizationName ?? row.organizationId}
                <span className="block text-xs text-muted-foreground">
                  {row.companyWebsite ? (
                    <a
                      href={row.companyWebsite}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline underline-offset-2"
                    >
                      {row.companyName ?? row.companyWebsite}
                    </a>
                  ) : (
                    (row.companyName ?? "No company given")
                  )}
                </span>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <span className="flex flex-wrap gap-1">
                  {row.countries.map((code) => (
                    <Badge key={code} variant="secondary" className="font-normal">
                      {code}
                    </Badge>
                  ))}
                </span>
              </TableCell>
              <TableCell>
                <SmsSenderStatusBadge status={row.status} />
                {row.registrationId && (
                  <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                    {row.registrationId}
                  </span>
                )}
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {formatDate(row.createdAt)}
              </TableCell>
              <TableCell>
                {row.status === "pending" && (
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`Approve ${row.senderId}`}
                      onClick={() => setReviewing({ row, approve: true })}
                    >
                      <CheckIcon />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`Reject ${row.senderId}`}
                      onClick={() => setReviewing({ row, approve: false })}
                    >
                      <XIcon />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ReviewDialog review={reviewing} onClose={() => setReviewing(null)} />
    </>
  );
}

function ReviewDialog({
  review,
  onClose,
}: {
  review: { row: QueueRow; approve: boolean } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [registrationId, setRegistrationId] = useState("");
  const [note, setNote] = useState("");

  const reviewMutation = useMutation(
    trpc.smsSender.review.mutationOptions({
      onSuccess: (updated) => {
        void queryClient.invalidateQueries(trpc.smsSender.pathFilter());
        toast.success(`${updated.senderId} ${updated.status}`);
        onClose();
        setRegistrationId("");
        setNote("");
      },
    }),
  );

  if (!review) return null;
  const { row, approve } = review;
  // A rejection the customer cannot act on is worse than none, so the reason
  // is required here as well as on the server.
  const canSubmit = approve || note.trim().length > 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {approve ? "Approve" : "Reject"} {row.senderId}
          </DialogTitle>
          <DialogDescription>
            {row.organizationName ?? row.organizationId} — {row.countries.join(", ")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">Sample message</p>
            <p className="mt-1 text-muted-foreground">
              {row.sampleMessage ??
                "None given. These destinations accept the sender id without a carrier registration, so the request is only our allowlist."}
            </p>
          </div>

          {approve && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="registration-id">Registration reference</Label>
              <Input
                id="registration-id"
                placeholder="AWS registration id or carrier ticket"
                value={registrationId}
                onChange={(e) => setRegistrationId(e.target.value)}
                disabled={reviewMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                What was filed upstream, so this row can be traced back to it later.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="review-note">{approve ? "Note (optional)" : "Reason"}</Label>
            <Textarea
              id="review-note"
              placeholder={
                approve
                  ? "Anything worth recording about the registration."
                  : "The carrier rejected the name as too generic. Try a name matching your brand."
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              disabled={reviewMutation.isPending}
            />
            {!approve && (
              <p className="text-xs text-muted-foreground">The customer reads this.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button
            disabled={reviewMutation.isPending || !canSubmit}
            onClick={() =>
              reviewMutation.mutate({
                id: row.id,
                status: approve ? "approved" : "rejected",
                registrationId: registrationId.trim() || undefined,
                note: note.trim() || undefined,
              })
            }
          >
            {reviewMutation.isPending ? <Spinner /> : approve ? <CheckIcon /> : <XIcon />}
            {approve ? "Approve" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
