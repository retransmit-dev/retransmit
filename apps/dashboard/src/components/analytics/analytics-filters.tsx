"use client";

import { DateRangePicker } from "@/components/date-range-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";

import type { AnalyticsFilters } from "./use-overview";

export function AnalyticsFilterBar({
  filters,
  onChange,
}: {
  filters: AnalyticsFilters;
  onChange: (patch: Partial<AnalyticsFilters>) => void;
}) {
  // A filter option, not the page's data: if the domain list fails the select
  // still offers "All domains".
  const domains = useQuery(
    trpc.domain.list.queryOptions(undefined, { throwOnError: false }),
  );
  const items = [
    { value: "all", label: "All domains" },
    ...(domains.data ?? []).map((row) => ({ value: row.id, label: row.name })),
  ];

  return (
    <>
      <Select
        items={items}
        value={filters.domainId}
        onValueChange={(value) => onChange({ domainId: value as string })}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DateRangePicker
        value={filters.range}
        onChange={(range) => onChange({ range })}
      />
    </>
  );
}
