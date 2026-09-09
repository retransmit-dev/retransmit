"use client";

import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Flag and name for an SMS region id, falling back to the raw id so a region
 * this build no longer lists still reads as something rather than nothing.
 */
export function SmsRegionLabel({ region }: { region: string }) {
  const regions = useQuery(trpc.smsSender.regions.queryOptions());
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
