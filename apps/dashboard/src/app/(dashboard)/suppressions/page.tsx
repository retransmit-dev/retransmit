"use client";

import { SuppressionReasonBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/page-shell";
import {
  Dialog,
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
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { queryClient, trpc } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BanIcon,
  DownloadIcon,
  InfoIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useDeferredValue, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

const REASON_FILTERS = [
  { value: null, label: "All" },
  { value: "bounce", label: "Bounced" },
  { value: "complaint", label: "Complained" },
  { value: "manual", label: "Manual" },
  { value: "unsubscribe", label: "Unsubscribed" },
] as const;

type ReasonFilter = (typeof REASON_FILTERS)[number]["value"];

const IMPORT_CHUNK = 10_000;

function StatCard({
  value,
  label,
  tone,
}: {
  value: number | undefined;
  label: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className={cn("text-2xl font-semibold tabular-nums", tone)}>
        {value ?? "–"}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

/**
 * Parses a suppression CSV: one address per line, or `email,reason` rows
 * (a header row is skipped). Unknown reasons import as manual.
 */
type SuppressionEntry = { email: string; reason: "bounce" | "complaint" | "manual" | "unsubscribe" };
function parseSuppressionCsv(text: string): SuppressionEntry[] {
  const entries: SuppressionEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const cells = line.split(/[,;\t]/).map((cell) => cell.trim().replace(/^"|"$/g, ""));
    const email = cells[0];
    if (!email || !email.includes("@")) continue; // skips headers and blanks
    const rawReason = (cells[1] ?? "").toLowerCase();
    const reason = rawReason.includes("bounce")
      ? ("bounce" as const)
      : rawReason.includes("complain") || rawReason.includes("spam")
        ? ("complaint" as const)
        : rawReason.includes("unsub")
          ? ("unsubscribe" as const)
          : ("manual" as const);
    entries.push({ email, reason });
  }
  return entries;
}

function toCsv(rows: { email: string; reason: string; createdAt: string | Date }[]): string {
  const lines = ["email,reason,created_at"];
  for (const row of rows) {
    lines.push(`${row.email},${row.reason},${new Date(row.createdAt).toISOString()}`);
  }
  return lines.join("\n");
}

function downloadFile(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export default function SuppressionsPage() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [reason, setReason] = useState<ReasonFilter>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addValue, setAddValue] = useState("");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<SuppressionEntry[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const org = useQuery(trpc.organization.current.queryOptions());
  const canManage = org.data?.role === "owner" || org.data?.role === "admin";

  const stats = useQuery(trpc.suppression.stats.queryOptions());
  const list = useQuery(
    trpc.suppression.list.queryOptions({
      search: deferredSearch || undefined,
      reason: reason ?? undefined,
    }),
  );

  const invalidate = () => {
    void queryClient.invalidateQueries(trpc.suppression.pathFilter());
  };

  const addMutation = useMutation(
    trpc.suppression.add.mutationOptions({
      onSuccess: ({ added, skipped }) => {
        invalidate();
        setAddOpen(false);
        setAddValue("");
        toast.success(
          skipped > 0
            ? `${added} added, ${skipped} already suppressed or invalid`
            : `${added} address${added === 1 ? "" : "es"} suppressed`,
        );
      },
    }),
  );

  const removeMutation = useMutation(
    trpc.suppression.remove.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Removed. The address is sendable again.");
      },
    }),
  );

  const importMutation = useMutation(trpc.suppression.import.mutationOptions());

  const handleAdd = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const emails = addValue
      .split(/[\s,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (emails.length === 0) return;
    if (emails.length > 100) {
      toast.error("Add up to 100 addresses at a time. Use Import CSV for more.");
      return;
    }
    addMutation.mutate({ emails });
  };

  const handleFileSelected = async (file: File) => {
    const text = await file.text();
    const entries = parseSuppressionCsv(text);
    if (entries.length === 0) {
      toast.error("No email addresses found in that file");
      return;
    }
    setPendingImport(entries);
  };

  const runImport = async () => {
    if (!pendingImport) return;
    setImporting(true);
    try {
      let added = 0;
      let skipped = 0;
      for (let i = 0; i < pendingImport.length; i += IMPORT_CHUNK) {
        const result = await importMutation.mutateAsync({
          entries: pendingImport.slice(i, i + IMPORT_CHUNK),
        });
        added += result.added;
        skipped += result.skipped;
      }
      invalidate();
      setPendingImport(null);
      toast.success(
        skipped > 0
          ? `Imported ${added} addresses (${skipped} duplicate or invalid)`
          : `Imported ${added} addresses`,
      );
    } catch {
      // The query cache error handler already surfaced a toast.
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await queryClient.fetchQuery(trpc.suppression.exportAll.queryOptions());
      downloadFile(`suppressions-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
    } finally {
      setExporting(false);
    }
  };

  const hasAny = (stats.data?.total ?? 0) > 0;
  const rows = list.data?.rows ?? [];

  return (
    <PageShell>
      <PageHeader href="/suppressions" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard value={stats.data?.total} label="Total" />
        <StatCard value={stats.data?.bounce} label="Bounced" tone="text-red-500" />
        <StatCard value={stats.data?.complaint} label="Complained" tone="text-amber-500" />
        <StatCard value={stats.data?.unsubscribe} label="Unsubscribed" />
        <StatCard value={stats.data?.manual} label="Added manually" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search address or @domain..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          {REASON_FILTERS.map((filter) => (
            <Button
              key={filter.label}
              variant={reason === filter.value ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setReason(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        <div className="ms-auto flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={handleExport}
            disabled={exporting || !hasAny}
          >
            {exporting ? <Spinner /> : <DownloadIcon />}
            Export CSV
          </Button>
          {canManage && (
            <>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <UploadIcon />
                Import CSV
              </Button>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Expected CSV format for imports"
                    />
                  }
                >
                  <InfoIcon className="size-4" />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80">
                  <PopoverHeader>
                    <PopoverTitle>CSV import format</PopoverTitle>
                    <PopoverDescription>
                      A .csv or .txt file with one address per line. An
                      optional second column sets the reason: bounce,
                      complaint, unsubscribe, or manual. A header row is
                      fine, it gets skipped.
                    </PopoverDescription>
                  </PopoverHeader>
                  <pre className="rounded-md bg-muted p-2 font-mono text-xs leading-relaxed">
                    {"email,reason\nuser@example.com,bounce\nother@example.com,complaint\nplain@example.com"}
                  </pre>
                  <p className="text-xs text-muted-foreground">
                    Rows without a recognized reason import as manual, and
                    exports from another provider usually work as-is.
                  </p>
                </PopoverContent>
              </Popover>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleFileSelected(file);
                }}
              />
              <Button onClick={() => setAddOpen(true)}>
                <PlusIcon />
                Add address
              </Button>
            </>
          )}
        </div>
      </div>

      {list.isLoading || stats.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <Empty className="rounded-lg border border-dashed py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BanIcon />
            </EmptyMedia>
            <EmptyTitle>
              {hasAny ? "No matches." : "Nothing suppressed yet."}
            </EmptyTitle>
            <EmptyDescription>
              {hasAny
                ? "No suppressed addresses match this search or filter."
                : "Hard bounces and spam complaints land here automatically. Migrating from another provider? Import their suppression list so those addresses never get a first send from us."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="hidden sm:table-cell">Added</TableHead>
                {canManage && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.email}</TableCell>
                  <TableCell>
                    <SuppressionReasonBadge reason={row.reason} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${row.email} from suppressions`}
                        onClick={() => removeMutation.mutate({ ids: [row.id] })}
                        disabled={removeMutation.isPending}
                      >
                        <Trash2Icon className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {list.data && list.data.total > rows.length && (
            <p className="text-sm text-muted-foreground">
              Showing the {rows.length} most recent of {list.data.total}. Use
              search to narrow down, or export the full list.
            </p>
          )}
        </>
      )}

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="p-4 sm:max-w-md">
          <SheetHeader className="p-0">
            <SheetTitle>Add addresses to the suppression list</SheetTitle>
            <SheetDescription>
              These addresses will not receive email from this organization
              until they are removed from the list. A domain entry like
              @example.com suppresses every address at that domain.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleAdd} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="suppress-addresses">Addresses</Label>
              <Textarea
                id="suppress-addresses"
                placeholder={"user@example.com\n@example.com"}
                rows={6}
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                autoFocus
                disabled={addMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                One per line, or separated by commas or spaces. Up to 100 at a
                time.
              </p>
            </div>
            <Button type="submit" disabled={addMutation.isPending || !addValue.trim()}>
              {addMutation.isPending ? <Spinner /> : <PlusIcon />}
              Suppress addresses
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog
        open={pendingImport !== null}
        onOpenChange={(open) => !open && !importing && setPendingImport(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import suppression list</DialogTitle>
            <DialogDescription>
              Found {pendingImport?.length ?? 0} addresses in the file.
              Addresses already on the list are skipped, so re-importing is
              safe.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingImport(null)}
              disabled={importing}
            >
              Cancel
            </Button>
            <Button onClick={() => void runImport()} disabled={importing}>
              {importing ? <Spinner /> : <UploadIcon />}
              Import {pendingImport?.length ?? 0} addresses
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
