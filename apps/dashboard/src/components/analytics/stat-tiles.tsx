"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { chartConfig, METRICS, rate } from "./chart-config";
import type { Metric } from "./chart-config";
import { useOverview } from "./use-overview";
import type { AnalyticsFilters } from "./use-overview";

export function StatTiles({ filters }: { filters: AnalyticsFilters }) {
  const { query, totals } = useOverview(filters);

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 lg:grid-cols-6",
        query.isFetching && !query.isLoading && "opacity-60",
      )}
    >
      {query.isLoading ? (
        METRICS.map((metric) => (
          <Skeleton key={metric} className="h-24 w-full" />
        ))
      ) : (
        <>
          <StatTile metric="sent" value={totals.sent} />
          <StatTile
            metric="delivered"
            value={totals.delivered}
            caption={`${rate(totals.delivered, totals.sent)} of sent`}
          />
          <StatTile
            metric="opened"
            value={totals.opened}
            caption={`${rate(totals.opened, totals.delivered)} of delivered`}
          />
          <StatTile
            metric="clicked"
            value={totals.clicked}
            caption={`${rate(totals.clicked, totals.delivered)} of delivered`}
          />
          <StatTile
            metric="bounced"
            value={totals.bounced}
            caption={`${rate(totals.bounced, totals.sent)} of sent`}
          />
          <StatTile
            metric="complained"
            value={totals.complained}
            caption={`${rate(totals.complained, totals.sent)} of sent`}
          />
        </>
      )}
    </div>
  );
}

function StatTile({
  metric,
  value,
  caption,
}: {
  metric: Metric;
  value: number;
  caption?: string;
}) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ background: chartConfig[metric].color }}
          />
          {chartConfig[metric].label}
        </p>
        <p className="text-2xl font-semibold">{value.toLocaleString()}</p>
        {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
      </CardContent>
    </Card>
  );
}
