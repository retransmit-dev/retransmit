"use client";

import { DomainStatusBadge } from "@/components/status-badges";
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
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/page-shell";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { queryClient, trpc } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckIcon,
  CopyIcon,
  GlobeIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-6 shrink-0"
      aria-label="Copy value"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
    </Button>
  );
}

function DnsRecordsTable({
  records,
}: {
  records: { type: string; name: string; value: string; purpose: string; required: boolean }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {records.map((record) => (
        <div key={record.name} className="rounded-md border p-3 text-sm">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {record.type}
            </span>
            <span className="text-xs uppercase text-muted-foreground">
              {record.purpose}
            </span>
            {!record.required && (
              <span className="text-xs text-muted-foreground">(recommended)</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <code className="min-w-0 flex-1 truncate font-mono text-xs">{record.name}</code>
            <CopyButton value={record.name} />
          </div>
          <div className="mt-1 flex items-center gap-1">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
              {record.value}
            </code>
            <CopyButton value={record.value} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DomainDetailsSheet({
  domainId,
  onClose,
}: {
  domainId: string | null;
  onClose: () => void;
}) {
  const details = useQuery(
    trpc.domain.get.queryOptions({ id: domainId ?? "" }, { enabled: domainId !== null }),
  );
  const verifyMutation = useMutation(
    trpc.domain.verify.mutationOptions({
      onSuccess: (updated) => {
        void queryClient.invalidateQueries(trpc.domain.pathFilter());
        toast[updated.status === "verified" ? "success" : "info"](
          updated.status === "verified"
            ? `${updated.name} is verified`
            : `${updated.name} is still ${updated.status.replace("_", " ")} — DNS changes can take a while to propagate`,
        );
      },
    }),
  );

  const isVerified = details.data?.status === "verified";

  return (
    <Sheet open={domainId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="overflow-y-auto p-4 sm:max-w-md">
        <SheetHeader className="p-0">
          <SheetTitle className="flex items-center gap-2">
            {details.data?.name ?? "Domain"}
            {details.data && <DomainStatusBadge status={details.data.status} />}
          </SheetTitle>
          <SheetDescription>
            {isVerified
              ? "This domain is verified and ready to send. These DNS records back its DKIM signing — keep them published."
              : "Publish these records at your DNS provider, then check the verification status. Verification usually completes within a few minutes but can take up to 72 hours."}
          </SheetDescription>
        </SheetHeader>
        {details.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : details.data ? (
          <>
            <DnsRecordsTable records={details.data.dnsRecords} />
            <Button
              variant={isVerified ? "outline" : "default"}
              onClick={() => details.data && verifyMutation.mutate({ id: details.data.id })}
              disabled={verifyMutation.isPending}
            >
              {verifyMutation.isPending ? <Spinner /> : <RefreshCwIcon />}
              {isVerified ? "Re-check status" : "Check verification status"}
            </Button>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export default function DomainsPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const domains = useQuery(trpc.domain.list.queryOptions());

  const createMutation = useMutation(
    trpc.domain.create.mutationOptions({
      onSuccess: (created) => {
        void queryClient.invalidateQueries(trpc.domain.pathFilter());
        setAddOpen(false);
        setNewDomain("");
        if (created.status === "verified") {
          toast.success(`${created.name} added and already verified`);
        } else {
          toast.success(`${created.name} added — publish its DNS records to verify`);
        }
        setSelectedId(created.id);
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.domain.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.domain.pathFilter());
        toast.success("Domain removed");
      },
    }),
  );

  const handleCreate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newDomain.trim()) {
      createMutation.mutate({ name: newDomain.trim() });
    }
  };

  return (
    <PageShell>
      <PageHeader
        href="/domains"
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <PlusIcon />
            Add domain
          </Button>
        }
      />

      {domains.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : !domains.data || domains.data.length === 0 ? (
        <Empty className="border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GlobeIcon />
            </EmptyMedia>
            <EmptyTitle>No domains yet</EmptyTitle>
            <EmptyDescription>
              Add a domain you own, publish its DKIM records, and start sending
              from it.
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => setAddOpen(true)}>
            <PlusIcon />
            Add domain
          </Button>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Region</TableHead>
              <TableHead className="hidden sm:table-cell">Added</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {domains.data.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => setSelectedId(row.id)}
              >
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>
                  <DomainStatusBadge status={row.status} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {row.region}
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {new Date(row.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${row.name}`}
                        />
                      }
                    >
                      <Trash2Icon className="size-4 text-destructive" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {row.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Sending from this domain will stop immediately and
                          its DKIM setup will be removed from Retransmit.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate({ id: row.id })}
                        >
                          Remove domain
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="p-4 sm:max-w-md">
          <SheetHeader className="p-0">
            <SheetTitle>Add a domain</SheetTitle>
            <SheetDescription>
              Use a domain you own. After adding it you will get the DNS
              records to publish for verification.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="domain-name">Domain</Label>
              <Input
                id="domain-name"
                placeholder="mail.example.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                autoFocus
                disabled={createMutation.isPending}
              />
            </div>
            <Button
              type="submit"
              disabled={createMutation.isPending || !newDomain.trim()}
            >
              {createMutation.isPending ? <Spinner /> : <PlusIcon />}
              Add domain
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <DomainDetailsSheet domainId={selectedId} onClose={() => setSelectedId(null)} />
    </PageShell>
  );
}
