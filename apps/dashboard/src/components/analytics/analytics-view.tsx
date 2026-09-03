"use client";

import type { DateRange } from "@/components/date-range-picker";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageHeader } from "@/components/page-shell";
import { useState } from "react";

import { AnalyticsFilterBar } from "./analytics-filters";
import { DeliveryIssuesChart } from "./delivery-issues-chart";
import { EngagementChart } from "./engagement-chart";
import { StatTiles } from "./stat-tiles";
import type { AnalyticsFilters } from "./use-overview";
import { VolumeChart } from "./volume-chart";

/**
 * Owns the filters the header and every section share. The header lives
 * here rather than in the page because its actions are the filter controls.
 */
export function AnalyticsView({ initialRange }: { initialRange: DateRange }) {
  const [filters, setFilters] = useState<AnalyticsFilters>(() => ({
    domainId: "all",
    range: initialRange,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }));
  const changeFilters = (patch: Partial<AnalyticsFilters>) =>
    setFilters((current) => ({ ...current, ...patch }));

  return (
    <>
      <PageHeader
        href="/"
        actions={
          <AnalyticsFilterBar filters={filters} onChange={changeFilters} />
        }
      />

      <div className="flex flex-col gap-4">
        <ErrorBoundary title="Could not load totals">
          <StatTiles filters={filters} />
        </ErrorBoundary>

        <ErrorBoundary title="Could not load volume">
          <VolumeChart filters={filters} />
        </ErrorBoundary>

        <div className="grid gap-4 lg:grid-cols-2">
          <ErrorBoundary title="Could not load engagement">
            <EngagementChart filters={filters} />
          </ErrorBoundary>
          <ErrorBoundary title="Could not load delivery issues">
            <DeliveryIssuesChart filters={filters} />
          </ErrorBoundary>
        </div>
      </div>
    </>
  );
}
