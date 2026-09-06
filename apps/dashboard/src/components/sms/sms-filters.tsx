"use client";

import type { DateRange } from "@/components/date-range-picker";
import { DateRangePicker } from "@/components/date-range-picker";
import { SMS_STATUS_OPTIONS, StatusDot } from "@/components/status-badges";
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
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";

export type SmsFilters = {
  search: string;
  range: DateRange;
  /** An SMS status, or "all". */
  status: string;
  /** An API key id, or "all". */
  apiKeyId: string;
};

const STATUS_ITEMS: { value: string; label: string; dot?: string }[] = [
  { value: "all", label: "All statuses" },
  ...SMS_STATUS_OPTIONS.map((option) => ({
    value: option.value as string,
    label: option.label,
    dot: option.dot,
  })),
];

const ALL_KEYS = { value: "all", label: "All API keys" };

export function SmsFilterBar({
  filters,
  onChange,
}: {
  filters: SmsFilters;
  onChange: (patch: Partial<SmsFilters>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <InputGroup className="min-w-64 flex-1">
        <InputGroupInput
          placeholder="Search number, sender or text..."
          aria-label="Search SMS"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>
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
              {item.dot && <StatusDot className={item.dot} />}
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
