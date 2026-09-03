"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { parseSuppressionCsv } from "@/lib/suppressions-csv";
import type { SuppressionEntry } from "@/lib/suppressions-csv";
import { trpc } from "@/utils/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, MoreVerticalIcon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useExportSuppressions } from "./use-export-suppressions";

const IMPORT_CHUNK = 10_000;

/**
 * The "more" menu with Import CSV (admins only) and Export CSV, plus the
 * hidden file input and confirmation dialog the import flow needs. Those
 * live here rather than in the menu content, which unmounts when it closes.
 */
export function SuppressionsActionsMenu({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<SuppressionEntry[] | null>(null);
  const [importing, setImporting] = useState(false);
  const importMutation = useMutation(trpc.suppression.import.mutationOptions());
  const { exportCsv, exporting, disabled: exportDisabled } =
    useExportSuppressions();

  const handleFileSelected = async (file: File) => {
    const entries = parseSuppressionCsv(await file.text());
    if (entries.length === 0) {
      toast.error("No email addresses found in that file", {
        description:
          "Expected one address per line, with an optional reason column: bounce, complaint, unsubscribe, or manual.",
      });
      return;
    }
    setPending(entries);
  };

  const runImport = async () => {
    if (!pending) return;
    setImporting(true);
    try {
      let added = 0;
      let skipped = 0;
      for (let i = 0; i < pending.length; i += IMPORT_CHUNK) {
        const result = await importMutation.mutateAsync({
          entries: pending.slice(i, i + IMPORT_CHUNK),
        });
        added += result.added;
        skipped += result.skipped;
      }
      void queryClient.invalidateQueries(trpc.suppression.pathFilter());
      setPending(null);
      toast.success(
        skipped > 0
          ? `Imported ${added}; skipped ${skipped}`
          : `Imported ${added} addresses`,
      );
    } catch {
      // The mutation cache already surfaced a toast.
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="More actions" />
          }
        >
          {exporting ? <Spinner /> : <MoreVerticalIcon className="size-4" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canManage && (
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <UploadIcon />
              Import CSV
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            disabled={exportDisabled}
            onClick={() => void exportCsv()}
          >
            <DownloadIcon />
            Export CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {canManage && (
        <>
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

          <Dialog
            open={pending !== null}
            onOpenChange={(open) => !open && !importing && setPending(null)}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import suppression list</DialogTitle>
                <DialogDescription>
                  Found {pending?.length ?? 0} addresses. Duplicates are
                  skipped and unknown reasons become manual.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setPending(null)}
                  disabled={importing}
                >
                  Cancel
                </Button>
                <Button onClick={() => void runImport()} disabled={importing}>
                  {importing ? <Spinner /> : <UploadIcon />}
                  Import {pending?.length ?? 0} addresses
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  );
}
