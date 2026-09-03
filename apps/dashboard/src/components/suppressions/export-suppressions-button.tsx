"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { downloadFile, toCsv } from "@/lib/suppressions-csv";
import { trpc } from "@/utils/trpc";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { useState } from "react";

export function ExportSuppressionsButton() {
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const stats = useQuery(
    trpc.suppression.stats.queryOptions(undefined, { throwOnError: false }),
  );
  const hasAny = (stats.data?.total ?? 0) > 0;

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await queryClient.query(
        trpc.suppression.exportAll.queryOptions(),
      );
      downloadFile(
        `suppressions-${new Date().toISOString().slice(0, 10)}.csv`,
        toCsv(rows),
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button variant="ghost" onClick={handleExport} disabled={exporting || !hasAny}>
      {exporting ? <Spinner /> : <DownloadIcon />}
      Export CSV
    </Button>
  );
}
