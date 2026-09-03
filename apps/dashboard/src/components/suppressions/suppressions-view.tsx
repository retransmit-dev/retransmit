"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { useState } from "react";

import { AddSuppressionsSheet } from "./add-suppressions-sheet";
import { SuppressionFilterBar } from "./suppression-filters";
import type { SuppressionFilters } from "./suppression-filters";
import { SuppressionsActionsMenu } from "./suppressions-actions-menu";
import { SuppressionsTable } from "./suppressions-table";

/** Owns what the toolbar and the table share: the filters and the page. */
export function SuppressionsView() {
  const [filters, setFilters] = useState<SuppressionFilters>({
    search: "",
    reason: null,
  });
  const [page, setPage] = useState(0);
  const { canManage } = useCurrentOrganization();

  // Every filter change restarts pagination from the first page.
  const changeFilters = (patch: Partial<SuppressionFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(0);
  };

  return (
    <>
      <SuppressionFilterBar filters={filters} onChange={changeFilters}>
        {canManage && <AddSuppressionsSheet />}
        <SuppressionsActionsMenu canManage={canManage} />
      </SuppressionFilterBar>

      <ErrorBoundary title="Could not load suppressions">
        <SuppressionsTable filters={filters} page={page} onPageChange={setPage} />
      </ErrorBoundary>
    </>
  );
}
