"use client";

import { StatusDot, SUPPRESSION_REASON } from "@/components/status-badges";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchIcon } from "lucide-react";
import type { ReactNode } from "react";

export const REASON_FILTERS = [
  { value: null, label: "All reasons" },
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

/** The Select needs string values; "all" stands in for the null filter. */
const ALL = "all";
const REASON_ITEMS = REASON_FILTERS.map((filter) => ({
  value: filter.value ?? ALL,
  label: filter.label,
  dot: filter.value ? SUPPRESSION_REASON[filter.value]?.dot : undefined,
}));

/** Search and reason select on the left; `children` (the actions) on the right. */
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
      <InputGroup className="min-w-64 flex-1">
        <InputGroupInput
          placeholder="Search address or @domain..."
          aria-label="Search suppressions"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>
      <Select
        items={REASON_ITEMS}
        value={filters.reason ?? ALL}
        onValueChange={(value) =>
          onChange({ reason: value === ALL ? null : (value as ReasonFilter) })
        }
      >
        <SelectTrigger className="w-40" aria-label="Reason">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REASON_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.dot && <StatusDot className={item.dot} />}
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="ms-auto flex items-center gap-2">{children}</div>
    </div>
  );
}
