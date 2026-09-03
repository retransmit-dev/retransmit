"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchIcon } from "lucide-react";
import type { ReactNode } from "react";

export const REASON_FILTERS = [
  { value: null, label: "All" },
  { value: "bounce", label: "Bounced" },
  { value: "complaint", label: "Complained" },
  { value: "manual", label: "Manual" },
  { value: "unsubscribe", label: "Unsubscribed" },
] as const;

export type ReasonFilter = (typeof REASON_FILTERS)[number]["value"];

export type SuppressionFilters = {
  search: string;
  reason: ReasonFilter;
};

/** Search and reason chips on the left; `children` (the actions) on the right. */
export function SuppressionFilterBar({
  filters,
  onChange,
  children,
}: {
  filters: SuppressionFilters;
  onChange: (patch: Partial<SuppressionFilters>) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search address or @domain..."
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
      </div>
      <div className="flex items-center gap-1">
        {REASON_FILTERS.map((filter) => (
          <Button
            key={filter.label}
            variant={filters.reason === filter.value ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => onChange({ reason: filter.value })}
          >
            {filter.label}
          </Button>
        ))}
      </div>
      <div className="ms-auto flex items-center gap-2">{children}</div>
    </div>
  );
}
