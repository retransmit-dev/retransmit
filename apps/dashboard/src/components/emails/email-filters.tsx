"use client";

import { DateRangePicker } from "@/components/date-range-picker";
import type { DateRange } from "@/components/date-range-picker";
import { EMAIL_STATUS_OPTIONS } from "@/components/status-badges";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";

export type EmailFilters = {
  search: string;
  range: DateRange;
  /** An email status, or "all". */
  status: string;
  /** An API key id, or "all". */
  apiKeyId: string;
};

const STATUS_ITEMS = [
  { value: "all", label: "All statuses" },
  ...EMAIL_STATUS_OPTIONS.map((option) => ({
    value: option.value as string,
    label: option.label,
  })),
];

const ALL_KEYS = { value: "all", label: "All API keys" };

export function EmailFilterBar({
  filters,
  onChange,
}: {
  filters: EmailFilters;
  onChange: (patch: Partial<EmailFilters>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1">
        <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search..."
          aria-label="Search emails"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
      </div>
      <DateRangePicker
        value={filters.range}
        onChange={(range) => onChange({ range })}
      />
      <Select
        items={STATUS_ITEMS}
        value={filters.status}
        onValueChange={(value) => onChange({ status: value as string })}
      >
        <SelectTrigger className="w-40" aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ApiKeySelect
        value={filters.apiKeyId}
        onChange={(apiKeyId) => onChange({ apiKeyId })}
      />
    </div>
  );
}

function ApiKeySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  // A filter option, not the page's data: if the key list fails the select
  // still offers "All API keys" rather than replacing the toolbar.
  const apiKeys = useQuery(
    trpc.apiKey.list.queryOptions(undefined, { throwOnError: false }),
  );
  const items = [
    ALL_KEYS,
    ...(apiKeys.data ?? []).map((key) => ({
      value: key.id,
      label: key.revokedAt ? `${key.name} (revoked)` : key.name,
    })),
  ];

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => onChange(next as string)}
    >
      <SelectTrigger className="w-40" aria-label="API key">
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
  );
}
