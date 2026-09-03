"use client";

import { downloadFile, toCsv } from "@/lib/suppressions-csv";
import { trpc } from "@/utils/trpc";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

/** Downloads the whole list as CSV; disabled while empty or in flight. */
export function useExportSuppressions() {
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const stats = useQuery(
    trpc.suppression.stats.queryOptions(undefined, { throwOnError: false }),
  );
  const hasAny = (stats.data?.total ?? 0) > 0;

  const exportCsv = async () => {
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

  return { exportCsv, exporting, disabled: exporting || !hasAny };
}
