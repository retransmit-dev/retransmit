"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import { DomainStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { DnsRecords } from "./dns-records";

export function DomainDetailsSheet({
  domainId,
  onClose,
}: {
  domainId: string | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={domainId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="overflow-y-auto p-4 sm:max-w-md">
        <ErrorBoundary title="Could not load this domain">
          {domainId !== null && <DomainDetailsBody domainId={domainId} />}
        </ErrorBoundary>
      </SheetContent>
    </Sheet>
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
      <SheetHeader className="p-0">
        <SheetTitle className="flex items-center gap-2">
          {domain?.name ?? "Domain"}
          {domain && <DomainStatusBadge status={domain.status} />}
        </SheetTitle>
        <SheetDescription>
          {isVerified
            ? "Ready to send. Keep these DKIM records published."
            : "Publish these DNS records, then check again. Changes may take 72 hours."}
        </SheetDescription>
      </SheetHeader>
      {details.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : domain ? (
        <>
          <DnsRecords records={domain.dnsRecords} />
          <Button
            variant={isVerified ? "outline" : "default"}
            onClick={() => verifyMutation.mutate({ id: domain.id })}
            disabled={verifyMutation.isPending}
          >
            {verifyMutation.isPending ? <Spinner /> : <RefreshCwIcon />}
            {isVerified ? "Re-check status" : "Check verification status"}
          </Button>
        </>
      ) : null}
    </>
  );
}
