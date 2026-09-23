"use client";

import { RegionSelect } from "@/components/selectors/region-select";
import { SmsRegionLabel } from "@/components/sms/region-label";
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
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
            <TableHead className="hidden xl:table-cell">Region</TableHead>
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
              <TableCell className="hidden text-sm whitespace-nowrap xl:table-cell">
                <SmsRegionLabel region={row.region} />
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
  const regions = useQuery(trpc.smsSender.regions.queryOptions());
  const [registrationId, setRegistrationId] = useState("");
  const [region, setRegion] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [dailyLimit, setDailyLimit] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [recipientDailyLimit, setRecipientDailyLimit] = useState("3");

  const reviewMutation = useMutation(
    trpc.smsSender.review.mutationOptions({
      onSuccess: (updated) => {
        void queryClient.invalidateQueries(trpc.smsSender.pathFilter());
        toast.success(`${updated.senderId} ${updated.status}`);
        onClose();
        setRegistrationId("");
        setRegion(null);
        setNote("");
        setDailyLimit("");
        setMonthlyLimit("");
        setRecipientDailyLimit("3");
      },
    }),
  );

  if (!review) return null;
  const { row, approve } = review;
  // Defaults to what the customer asked for; changed only when the
  // registration actually landed somewhere else.
  const selectedRegion = region ?? row.region;
  const approvedDailyLimit = Number(dailyLimit || row.expectedDailyVolume || 0);
  const approvedMonthlyLimit = Number(monthlyLimit || row.expectedMonthlyVolume || 0);
  const approvedRecipientLimit = Number(recipientDailyLimit);
  // A rejection the customer cannot act on is worse than none, so the reason
  // is required here as well as on the server.
  const canSubmit = approve
    ? selectedRegion === "af-south-1" &&
      Number.isInteger(approvedDailyLimit) &&
      approvedDailyLimit > 0 &&
      Number.isInteger(approvedMonthlyLimit) &&
      approvedMonthlyLimit >= approvedDailyLimit &&
      Number.isInteger(approvedRecipientLimit) &&
      approvedRecipientLimit > 0
    : note.trim().length > 0;

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

          <div className="grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-2">
            <p>
              <span className="block font-medium">Purposes</span>
              <span className="text-muted-foreground">{row.purposes.join(", ")}</span>
            </p>
            <p>
              <span className="block font-medium">Expected volume</span>
              <span className="text-muted-foreground">
                {row.expectedDailyVolume ?? "—"}/day · {row.expectedMonthlyVolume ?? "—"}/month
              </span>
            </p>
            {[
              ["Opt-in", row.optInUrl],
              ["Privacy", row.privacyUrl],
              ["SMS terms", row.termsUrl],
              ["Website", row.companyWebsite],
            ].map(([label, href]) => (
              <p key={label}>
                <span className="block font-medium">{label}</span>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="break-all text-muted-foreground underline underline-offset-2"
                  >
                    {href}
                  </a>
                ) : (
                  <span className="text-muted-foreground">Missing</span>
                )}
              </p>
            ))}
            <p className="sm:col-span-2">
              <span className="block font-medium">Support and opt-out</span>
              <span className="text-muted-foreground">
                {row.supportEmail ?? "Missing"} · {row.optOutText ?? "Missing"}
              </span>
            </p>
          </div>

          {approve && (
            <Field>
              <FieldLabel htmlFor="registration-id">Registration reference</FieldLabel>
              <Input
                id="registration-id"
                placeholder="AWS registration id or carrier ticket"
                value={registrationId}
                onChange={(e) => setRegistrationId(e.target.value)}
                disabled={reviewMutation.isPending}
              />
              <FieldDescription>
                What was filed upstream, so this row can be traced back to it later.
              </FieldDescription>
            </Field>
          )}

          {approve && (
            <Field>
              <FieldLabel htmlFor="review-region">Region</FieldLabel>
              <RegionSelect
                id="review-region"
                regions={regions.data?.regions}
                value={selectedRegion}
                onValueChange={setRegion}
                loading={regions.isLoading}
                disabled={reviewMutation.isPending}
              />
              <FieldDescription>
                Where the origination identity actually lives. Correct it if the registration
                landed somewhere other than {row.region}, or every send with this name fails.
              </FieldDescription>
            </Field>
          )}

          {approve && (
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="review-daily-limit">Daily cap</FieldLabel>
                  <Input
                    id="review-daily-limit"
                    type="number"
                    min={1}
                    value={dailyLimit || row.expectedDailyVolume || ""}
                    onChange={(event) => setDailyLimit(event.target.value)}
                    disabled={reviewMutation.isPending}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="review-monthly-limit">Monthly cap</FieldLabel>
                  <Input
                    id="review-monthly-limit"
                    type="number"
                    min={1}
                    value={monthlyLimit || row.expectedMonthlyVolume || ""}
                    onChange={(event) => setMonthlyLimit(event.target.value)}
                    disabled={reviewMutation.isPending}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="review-recipient-limit">Per recipient/day</FieldLabel>
                  <Input
                    id="review-recipient-limit"
                    type="number"
                    min={1}
                    max={100}
                    value={recipientDailyLimit}
                    onChange={(event) => setRecipientDailyLimit(event.target.value)}
                    disabled={reviewMutation.isPending}
                  />
                </Field>
              </div>
              <FieldDescription>
                Hard application limits. Start at or below the reviewed forecast and raise only
                after another review.
              </FieldDescription>
            </FieldGroup>
          )}

          <Field>
            <FieldLabel htmlFor="review-note">{approve ? "Note (optional)" : "Reason"}</FieldLabel>
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
            {!approve && <FieldDescription>The customer reads this.</FieldDescription>}
          </Field>
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
                region: approve && selectedRegion === "af-south-1" ? selectedRegion : undefined,
                note: note.trim() || undefined,
                dailyLimit: approve ? approvedDailyLimit : undefined,
                monthlyLimit: approve ? approvedMonthlyLimit : undefined,
                recipientDailyLimit: approve ? approvedRecipientLimit : undefined,
              })
            }
          >
            {reviewMutation.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : approve ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <XIcon data-icon="inline-start" />
            )}
            {approve ? "Approve" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
