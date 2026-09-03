"use client";

import type { DateRange } from "@/components/date-range-picker";
import { EmailDetailsSheet } from "@/components/emails/email-details-sheet";
import { EmailFilterBar } from "@/components/emails/email-filters";
import type { EmailFilters } from "@/components/emails/email-filters";
import { EmailsTable } from "@/components/emails/emails-table";
import { ErrorBoundary } from "@/components/error-boundary";
import { useState } from "react";

/**
 * Owns what the filter bar, the table and the details sheet share: the
 * active filters, the pagination stack and the selected email. Everything
 * else lives in the component that renders it.
 */
export function EmailsView({ initialRange }: { initialRange: DateRange }) {
  const [filters, setFilters] = useState<EmailFilters>({
    search: "",
    range: initialRange,
    status: "all",
    apiKeyId: "all",
  });
  const [cursors, setCursors] = useState<Date[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Every filter change restarts pagination from the first page.
  const changeFilters = (patch: Partial<EmailFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setCursors([]);
  };

  return (
    <>
      <EmailFilterBar filters={filters} onChange={changeFilters} />

      <ErrorBoundary title="Could not load emails">
        <EmailsTable
          filters={filters}
          cursors={cursors}
          onCursorsChange={setCursors}
          onSelect={setSelectedId}
        />
      </ErrorBoundary>

      <EmailDetailsSheet
        emailId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
