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

export function VolumeChart({ filters }: { filters: AnalyticsFilters }) {
  const { query, series } = useOverview(filters);

  return (
    <ChartCard
      title="Volume"
      description="Sent, delivered, and opened."
      loading={query.isLoading}
      fetching={query.isFetching}
    >
      <BarChart data={series} margin={{ left: 0, right: 12 }} barGap={2}>
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
        {(["sent", "delivered", "opened"] as const).map((metric) => (
          <Bar
            key={metric}
            dataKey={metric}
            fill={`var(--color-${metric})`}
            radius={[4, 4, 0, 0]}
            maxBarSize={16}
          />
        ))}
      </BarChart>
    </ChartCard>
  );
}
