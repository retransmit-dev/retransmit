"use client";

import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";

/** Flag and name for an SES region id, falling back to the raw id. */
export function RegionLabel({ region }: { region: string }) {
  const regions = useQuery(trpc.domain.regions.queryOptions());
  const option = regions.data?.regions.find((entry) => entry.id === region);
  if (!option) return <>{region}</>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden>{option.flag}</span>
      <span>{option.name}</span>
      <span className="text-muted-foreground">({region})</span>
    </span>
  );
}
