"use client";

import { DateRangePicker } from "@/components/date-range-picker";
import type { DateRange } from "@/components/date-range-picker";
import { EMAIL_STATUS_OPTIONS, StatusDot } from "@/components/status-badges";
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

export type EmailFilters = {
  search: string;
  range: DateRange;
  /** An email status, or "all". */
  status: string;
  /** An API key id, or "all". */
  apiKeyId: string;
  /** A tag encoded as `name=value`, or "all". */
  tag: string;
};

const TAG_SEPARATOR = "=";

export function encodeTag(tag: { name: string; value: string }) {
  return `${tag.name}${TAG_SEPARATOR}${tag.value}`;
}

/** Inverse of `encodeTag`; returns undefined for "all" or malformed input. */
export function decodeTag(encoded: string) {
  const index = encoded.indexOf(TAG_SEPARATOR);
  if (index <= 0) return undefined;
  return { name: encoded.slice(0, index), value: encoded.slice(index + 1) };
}

const STATUS_ITEMS: { value: string; label: string; dot?: string }[] = [
  { value: "all", label: "All statuses" },
  ...EMAIL_STATUS_OPTIONS.map((option) => ({
    value: option.value as string,
    label: option.label,
    dot: option.dot,
  })),
];

const ALL_KEYS = { value: "all", label: "All API keys" };
const ALL_TAGS = { value: "all", label: "All tags" };

export function EmailFilterBar({
  filters,
  onChange,
}: {
  filters: EmailFilters;
  onChange: (patch: Partial<EmailFilters>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <InputGroup className="min-w-64 flex-1">
        <InputGroupInput
          placeholder="Search..."
          aria-label="Search emails"
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
      <TagSelect value={filters.tag} onChange={(tag) => onChange({ tag })} />
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

function TagSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  // Like the API key list, a failure here leaves "All tags" in place instead
  // of taking the toolbar down.
  const tags = useQuery(
    trpc.email.tags.queryOptions(undefined, { throwOnError: false }),
  );
  const items = [
    ALL_TAGS,
    ...(tags.data ?? []).map((tag) => ({
      value: encodeTag(tag),
      label: `${tag.name}: ${tag.value}`,
    })),
  ];

  // Nothing tagged yet: hide the control rather than show an empty menu.
  if (tags.data && tags.data.length === 0 && value === "all") return null;

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => onChange(next as string)}
    >
      <SelectTrigger className="w-48" aria-label="Tag">
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
