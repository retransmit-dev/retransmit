"use client";

import {
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { ChartCard } from "./chart-card";
import { tooltipLabel } from "./chart-config";
import { useOverview } from "./use-overview";
import type { AnalyticsFilters } from "./use-overview";

export function EngagementChart({ filters }: { filters: AnalyticsFilters }) {
  const { query, series } = useOverview(filters);

  return (
    <ChartCard
      title="Engagement"
      description="Delivered, opened, and clicked."
      loading={query.isLoading}
      fetching={query.isFetching}
    >
      <LineChart data={series} margin={{ left: 0, right: 12 }}>
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
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={tooltipLabel}
            />
          }
        />
        <ChartLegend itemSorter={null} content={<ChartLegendContent />} />
        {(["delivered", "opened", "clicked"] as const).map((metric) => (
          <Line
            key={metric}
            dataKey={metric}
            type="monotone"
            stroke={`var(--color-${metric})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
          />
        ))}
      </LineChart>
    </ChartCard>
  );
}
