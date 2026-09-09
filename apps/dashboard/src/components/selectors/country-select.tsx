"use client";

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";
import type { RouterOutputs } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

type Country = RouterOutputs["smsSender"]["countries"]["countries"][number];

/**
 * Picks destination countries, anywhere one is asked for.
 *
 * The catalog is read from `smsSender.countries` rather than passed in, for
 * the same reason `useCountryLookup` does: the table lives in
 * @retransmit/sms with the sender-id policy that gives each entry meaning,
 * and every screen showing a country already loads that query, so a second
 * component costs a cache hit rather than a copy that can drift.
 *
 * Countries that do not accept alphanumeric sender ids are listed but
 * disabled, with the reason on the row: the honest answer belongs on screen,
 * not in a support thread after the customer has already integrated.
 */
export function CountrySelect({
  id,
  value,
  onValueChange,
  disabled = false,
  placeholder = "Search countries",
}: {
  id?: string;
  /** ISO 3166-1 alpha-2 codes, in the order they were picked. */
  value: string[];
  onValueChange: (codes: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const catalog = useQuery(trpc.smsSender.countries.queryOptions());
  const anchor = useComboboxAnchor();

  const countries = useMemo(() => catalog.data?.countries ?? [], [catalog.data]);
  const selected = useMemo(
    () =>
      value
        .map((code) => countries.find((country) => country.code === code))
        .filter((country): country is Country => country !== undefined),
    [value, countries],
  );

  if (catalog.isLoading) return <Skeleton className="h-9 w-full" />;

  return (
    <Combobox
      items={countries}
      multiple
      value={selected}
      onValueChange={(next) => onValueChange(next.map((country) => country.code))}
      isItemEqualToValue={(a, b) => a.code === b.code}
      itemToStringLabel={(country) => country.name}
      // Typing "237" or "cm" has to find Cameroon, not just its name: a dial
      // code is what someone reads off a phone number they are testing with.
      filter={(country: Country, query) => {
        const term = query.trim().toLowerCase();
        if (!term) return true;
        return (
          country.name.toLowerCase().includes(term) ||
          country.code.toLowerCase() === term ||
          country.dialCode.startsWith(term.replace(/^\+/, ""))
        );
      }}
      disabled={disabled}
    >
      <ComboboxChips ref={anchor} className="w-full">
        <ComboboxValue>
          {(items: Country[]) => (
            <>
              {items.map((country) => (
                <ComboboxChip key={country.code} aria-label={country.name}>
                  <span aria-hidden>{country.flag}</span>
                  {country.name}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                disabled={disabled}
                placeholder={items.length === 0 ? placeholder : undefined}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No country matches that.</ComboboxEmpty>
        <ComboboxList>
          {(country: Country) => {
            const unsupported = country.senderId === "unsupported";
            return (
              <ComboboxItem
                key={country.code}
                value={country}
                disabled={unsupported}
                className={cn("items-start py-1.5", unsupported && "opacity-60")}
              >
                <span className="text-base leading-none" aria-hidden>
                  {country.flag}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{country.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {unsupported
                      ? catalog.data?.unsupportedReason
                      : country.senderId === "registration"
                        ? "Carrier registration required"
                        : "No registration needed"}
                  </span>
                </span>
              </ComboboxItem>
            );
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
