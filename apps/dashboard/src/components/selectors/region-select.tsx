"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReactNode } from "react";

/** Shape SES and SMS regions share, so one control renders both. */
export type RegionOption = {
  id: string;
  name: string;
  location: string;
  flag: string;
};

/**
 * Picks an AWS region, anywhere one is asked for.
 *
 * Presentational on purpose: SES regions, SMS regions and the send-time
 * region come from three different procedures, and a component that fetched
 * one of them would be wrong on two screens out of three. The caller passes
 * the list it already loaded.
 *
 * `children` renders above the regions, for the one screen that offers
 * "Automatic" alongside them.
 */
export function RegionSelect({
  id,
  regions,
  value,
  onValueChange,
  disabled = false,
  loading = false,
  placeholder = "Pick a region",
  className = "w-full",
  children,
}: {
  id?: string;
  regions: readonly RegionOption[] | undefined;
  value: string | undefined;
  onValueChange: (region: string) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  className?: string;
  children?: ReactNode;
}) {
  if (loading) return <Skeleton className="h-9 w-full" />;

  return (
    <Select
      value={value ?? undefined}
      onValueChange={(next) => onValueChange(next as string)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {children}
        {regions?.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            <span aria-hidden>{option.flag}</span>
            <span>{option.name}</span>
            <span className="text-muted-foreground">{option.location}</span>
            <span className="font-mono text-xs text-muted-foreground">{option.id}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
