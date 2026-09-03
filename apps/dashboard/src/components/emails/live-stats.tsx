"use client";

import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";

/** Polls every few seconds so the tiles track a running batch. */
const LIVE_REFETCH_MS = 4000;

export function LiveStats() {
  const stats = useQuery(
    trpc.email.stats.queryOptions(undefined, {
      refetchInterval: LIVE_REFETCH_MS,
    }),
  );

  const counts = stats.data?.counts;
  const failed =
    (counts?.failed ?? 0) +
    (counts?.bounced ?? 0) +
    (counts?.rejected ?? 0) +
    (counts?.complained ?? 0) +
    (counts?.suppressed ?? 0);
  const tiles = [
    { label: "Total", value: stats.data?.total ?? 0 },
    { label: "Queued", value: counts?.queued ?? 0 },
    { label: "Sent", value: counts?.sent ?? 0 },
    {
      label: "Delivered",
      value:
        (counts?.delivered ?? 0) +
        (counts?.opened ?? 0) +
        (counts?.clicked ?? 0),
    },
    { label: "Failed", value: failed },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {tiles.map((tile) => (
        <Card key={tile.label} className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">{tile.label}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {tile.value.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
