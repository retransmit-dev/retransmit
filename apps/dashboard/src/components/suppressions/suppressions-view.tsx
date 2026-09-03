"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { useState } from "react";

import { AddSuppressionsSheet } from "./add-suppressions-sheet";
import { ExportSuppressionsButton } from "./export-suppressions-button";
import { ImportSuppressions } from "./import-suppressions";
import { SuppressionFilterBar } from "./suppression-filters";
import type { SuppressionFilters } from "./suppression-filters";
import { SuppressionsTable } from "./suppressions-table";

/** Owns the filters the toolbar and the table share. */
export function SuppressionsView() {
  const [filters, setFilters] = useState<SuppressionFilters>({
    search: "",
    reason: null,
  });
  const { canManage } = useCurrentOrganization();

  return (
    <>
      <SuppressionFilterBar
        filters={filters}
        onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
      >
        <ExportSuppressionsButton />
        {canManage && (
          <>
            <ImportSuppressions />
            <AddSuppressionsSheet />
          </>
        )}
      </SuppressionFilterBar>

      <ErrorBoundary title="Could not load suppressions">
        <SuppressionsTable filters={filters} />
      </ErrorBoundary>
    </>
  );
}
