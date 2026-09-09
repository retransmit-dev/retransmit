"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import { DomainStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { DnsRecords } from "./dns-records";
import { RegionLabel } from "./region-label";

export function DomainDetailsDialog({
  domainId,
  onClose,
}: {
  domainId: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={domainId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        <ErrorBoundary title="Could not load this domain">
          {domainId !== null && <DomainDetailsBody domainId={domainId} />}
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}

function DomainDetailsBody({ domainId }: { domainId: string }) {
  const queryClient = useQueryClient();
  const details = useQuery(trpc.domain.get.queryOptions({ id: domainId }));
  const verifyMutation = useMutation(
    trpc.domain.verify.mutationOptions({
      onSuccess: (updated) => {
        void queryClient.invalidateQueries(trpc.domain.pathFilter());
        toast[updated.status === "verified" ? "success" : "info"](
          updated.status === "verified"
            ? `${updated.name} is verified`
            : `${updated.name} is ${updated.status.replace("_", " ")}. DNS may take time.`,
        );
      },
    }),
  );

  const domain = details.data;
  const isVerified = domain?.status === "verified";

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {domain?.name ?? "Domain"}
          {domain && <DomainStatusBadge status={domain.status} />}
        </DialogTitle>
        <DialogDescription>
          {isVerified
            ? "Ready to send. Keep these DKIM records published."
            : "Publish these DNS records, then check again. Changes may take up to 72 hours."}
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        {details.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : domain ? (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Region</dt>
              <dd>
                <RegionLabel region={domain.region} />
              </dd>
              {domain.mailFromDomain && (
                <>
                  <dt className="text-muted-foreground">Return-Path</dt>
                  <dd className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-mono text-xs">{domain.mailFromDomain}</span>
                    {domain.mailFromStatus && (
                      <DomainStatusBadge status={domain.mailFromStatus} />
                    )}
                  </dd>
                </>
              )}
            </dl>
            <DnsRecords records={domain.dnsRecords} />
          </>
        ) : null}
      </DialogBody>
      {domain && (
        <DialogFooter>
          <Button
            variant={isVerified ? "outline" : "default"}
            onClick={() => verifyMutation.mutate({ id: domain.id })}
            disabled={verifyMutation.isPending}
          >
            {verifyMutation.isPending ? <Spinner /> : <RefreshCwIcon />}
            {isVerified ? "Re-check status" : "Check verification status"}
          </Button>
        </DialogFooter>
      )}
    </>
  );
}
