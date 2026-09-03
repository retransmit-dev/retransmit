"use client";

import type { DateRange } from "@/components/date-range-picker";
import { trpc } from "@/utils/trpc";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { eachDayOfInterval, eachHourOfInterval, format } from "date-fns";
import { useMemo } from "react";

import { ZERO_COUNTS } from "./chart-config";
import type { SeriesPoint, Totals } from "./chart-config";

export type AnalyticsFilters = {
  /** A domain id, or "all". */
  domainId: string;
  range: DateRange;
  timeZone: string;
};

/**
 * The overview query plus the series every chart draws. Each section calls
 * it on its own; the query is shared through the cache, so the network sees
 * one request.
 */
export function useOverview(filters: AnalyticsFilters) {
  const query = useQuery(
    trpc.analytics.overview.queryOptions(
      {
        from: filters.range.from,
        to: filters.range.to,
        domainId: filters.domainId === "all" ? undefined : filters.domainId,
        timeZone: filters.timeZone,
      },
      { placeholderData: keepPreviousData },
    ),
  );

  // The server returns only non-empty buckets; fill the gaps so the x-axis
  // covers the whole selected window.
  const series = useMemo<SeriesPoint[]>(() => {
    if (!query.data) return [];
    const byBucket = new Map(query.data.series.map((row) => [row.bucket, row]));
    const hourly = query.data.interval === "hour";
    const { from, to } = filters.range;
    // Don't chart hours that haven't happened yet.
    const now = new Date();
    const end = hourly && to > now ? now : to;
    const ticks = hourly
      ? eachHourOfInterval({ start: from, end })
      : eachDayOfInterval({ start: from, end: to });
    return ticks.map((tick) => ({
      label: format(tick, hourly ? "ha" : "MMM d"),
      full: format(tick, hourly ? "MMM d, ha" : "MMM d, yyyy"),
      ...ZERO_COUNTS,
      ...byBucket.get(format(tick, hourly ? "yyyy-MM-dd'T'HH" : "yyyy-MM-dd")),
    }));
  }, [query.data, filters.range]);

  const totals: Totals = query.data?.totals ?? ZERO_COUNTS;

  return { query, series, totals };
}
