"use client";

import type { DateRange } from "@/components/date-range-picker";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageHeader } from "@/components/page-shell";
import { SmsDetailsSheet } from "@/components/sms/sms-details-sheet";
import type { SmsFilters } from "@/components/sms/sms-filters";
import { SmsFilterBar } from "@/components/sms/sms-filters";
import { SmsTable } from "@/components/sms/sms-table";
import { Button } from "@/components/ui/button";
import { BadgeCheckIcon, FlaskConicalIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/**
 * Owns what the filter bar, the table and the details sheet share: the
 * active filters, the pagination stack and the selected message. Everything
 * else lives in the component that renders it.
 */
export function SmsView({
  initialRange,
  isAdmin,
}: {
  initialRange: DateRange;
  isAdmin: boolean;
}) {
  const [filters, setFilters] = useState<SmsFilters>({
    search: "",
    range: initialRange,
    status: "all",
    apiKeyId: "all",
  });
  const [cursors, setCursors] = useState<Date[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Every filter change restarts pagination from the first page.
  const changeFilters = (patch: Partial<SmsFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setCursors([]);
  };

  return (
    <>
      <PageHeader
        href="/sms"
        actions={
          <>
            <Button
              variant="default"
              nativeButton={false}
              render={<Link href="/sms/senders" />}
            >
              <BadgeCheckIcon />
              Sender IDs
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/sms/test" />}
              >
                <FlaskConicalIcon />
                Test send
              </Button>
            )}
          </>
        }
      />

      <SmsFilterBar filters={filters} onChange={changeFilters} />

      <ErrorBoundary title="Could not load SMS">
        <SmsTable
          filters={filters}
          cursors={cursors}
          onCursorsChange={setCursors}
          onSelect={setSelectedId}
        />
      </ErrorBoundary>

      <SmsDetailsSheet smsId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
