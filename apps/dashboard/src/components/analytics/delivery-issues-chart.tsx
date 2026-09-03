"use client";

import {
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartCard } from "./chart-card";
import { tooltipLabel } from "./chart-config";
import { useOverview } from "./use-overview";
import type { AnalyticsFilters } from "./use-overview";

export function DeliveryIssuesChart({ filters }: { filters: AnalyticsFilters }) {
  const { query, series } = useOverview(filters);

  return (
    <ChartCard
      title="Delivery issues"
      description="Bounces and spam complaints."
      loading={query.isLoading}
      fetching={query.isFetching}
    >
      <BarChart data={series} margin={{ left: 0, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          width={36}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={tooltipLabel} />}
        />
        <ChartLegend itemSorter={null} content={<ChartLegendContent />} />
        <Bar
          dataKey="bounced"
          stackId="issues"
          fill="var(--color-bounced)"
          stroke="var(--card)"
          strokeWidth={1}
          maxBarSize={24}
        />
        <Bar
          dataKey="complained"
          stackId="issues"
          fill="var(--color-complained)"
          stroke="var(--card)"
          strokeWidth={1}
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
        />
      </BarChart>
    </ChartCard>
  );
}
