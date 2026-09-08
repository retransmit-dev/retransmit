"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { formatMicros } from "@/lib/money";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * One editable price. Kept uncontrolled between edits so a keystroke does not
 * fight the query cache: it seeds from the row, and only commits on blur or
 * Enter, which is also when the mutation fires.
 */
function PriceInput({
  country,
  priceMicros,
  onSave,
  saving,
}: {
  country: string;
  priceMicros: number;
  onSave: (usd: number) => void;
  saving: boolean;
}) {
  const [value, setValue] = useState(formatMicros(priceMicros));
  const [dirty, setDirty] = useState(false);

  // A price changed elsewhere (or a save landing) should show through, but not
  // while this field is mid-edit.
  const current = formatMicros(priceMicros);
  if (!dirty && value !== current) setValue(current);

  const commit = () => {
    if (!dirty) return;
    const usd = Number(value);
    if (!Number.isFinite(usd) || usd < 0) {
      setValue(current);
      setDirty(false);
      return;
    }
    setDirty(false);
    if (usd !== Number(current)) onSave(usd);
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <span className="text-muted-foreground text-sm">$</span>
      <Input
        aria-label={`Price per SMS segment to ${country}`}
        className="h-8 w-24 text-right tabular-nums"
        inputMode="decimal"
        disabled={saving}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setDirty(true);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setValue(current);
            setDirty(false);
          }
        }}
      />
    </div>
  );
}

/**
 * The SMS rate card. Prices are per segment and per destination, because
 * carrier cost is: AWS list price spans $0.004 to $0.59 across the countries
 * we offer, so one number is either uncompetitive or sold at a loss.
 *
 * Two cost columns, because they answer different questions. "AWS list" is the
 * fallback that reaches everywhere and is what a seeded price is derived from.
 * "Route cost" is what the destination costs on the carrier routing would pick
 * right now, which is what margin and the below-cost warning are judged
 * against — otherwise every country with a direct MTN or Orange deal would look
 * like it was sold at a loss the moment it was priced competitively.
 */
export function SmsRatesTable() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const rates = useQuery(trpc.admin.smsRates.queryOptions(undefined, { throwOnError: true }));

  // Seeding is insert-only, so this is safe to press on a live deployment: it
  // fills destinations that have no price and leaves every existing one alone.
  const seed = useMutation(
    trpc.admin.seedRates.mutationOptions({
      onSuccess: ({ sms, whatsapp }) => {
        void queryClient.invalidateQueries(trpc.admin.smsRates.pathFilter());
        void queryClient.invalidateQueries(trpc.admin.whatsappRates.pathFilter());
        toast.success(
          sms === 0 && whatsapp === 0
            ? "Every destination already has a price"
            : `Seeded ${sms} destination${sms === 1 ? "" : "s"}` +
                (whatsapp > 0 ? ` and ${whatsapp} WhatsApp overrides` : ""),
        );
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const setRate = useMutation(
    trpc.admin.setSmsRate.mutationOptions({
      onSuccess: (_, variables) => {
        void queryClient.invalidateQueries(trpc.admin.smsRates.pathFilter());
        toast.success(`${variables.country} is now $${variables.priceUsd} per segment`);
      },
      onError: (error) => toast.error(error.message),
      onSettled: () => setSaving(null),
    }),
  );

  if (rates.isLoading) {
    return (
      <div className="grid gap-2">
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (!rates.data) return null;

  const term = query.trim().toLowerCase();
  const rows = rates.data.rates.filter(
    (row) =>
      !term ||
      row.country.toLowerCase().includes(term) ||
      row.name.toLowerCase().includes(term),
  );
  const belowCost = rates.data.rates.filter((row) => row.belowCost).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <SearchIcon className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input
            className="pl-8"
            placeholder="Filter by country"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <span className="text-muted-foreground text-sm">
          {rows.length} of {rates.data.rates.length} destinations · AWS list prices from{" "}
          {formatDate(rates.data.costsFetchedAt)} · {rates.data.configuredProviders} carrier
          {rates.data.configuredProviders === 1 ? "" : "s"} configured
        </span>
        {belowCost > 0 && (
          <Badge variant="destructive">{belowCost} below cost</Badge>
        )}
      </div>

      <div className="bg-muted/40 flex flex-wrap items-center gap-3 rounded-md border p-3">
        <Button
          variant="outline"
          size="sm"
          disabled={seed.isPending}
          onClick={() => seed.mutate()}
        >
          <DownloadIcon />
          {rates.data.seed.missing > 0
            ? `Seed ${rates.data.seed.missing} missing destination${
                rates.data.seed.missing === 1 ? "" : "s"
              }`
            : "Seed rate card"}
        </Button>
        <p className="text-muted-foreground text-sm">
          {rates.data.seed.missing === 0 && rates.data.seed.missingWhatsapp === 0 ? (
            <>
              All {rates.data.seed.total} destinations in the {rates.data.seed.generatedAt}{" "}
              snapshot are priced here. Seeding again would change nothing.
            </>
          ) : (
            <>
              Writes the {rates.data.seed.generatedAt} snapshot
              {rates.data.seed.tuned > 0 && `, including ${rates.data.seed.tuned} hand-tuned prices`}
              , into destinations with no price yet. Prices already set are never overwritten.
            </>
          )}
        </p>
      </div>

      <div className="max-h-[32rem] overflow-y-auto rounded-md border">
        <Table>
          <TableHeader className="bg-background sticky top-0 z-10">
            <TableRow>
              <TableHead>Destination</TableHead>
              <TableHead className="hidden md:table-cell text-right">AWS list</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Route cost</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Margin</TableHead>
              <TableHead className="text-right">Price / segment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.country} className={row.offered ? undefined : "opacity-60"}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span aria-hidden>{row.flag ?? "🏳️"}</span>
                    <span>{row.name}</span>
                    <code className="text-muted-foreground font-mono text-xs">{row.country}</code>
                    {row.source === "manual" && <Badge variant="outline">edited</Badge>}
                    {!row.offered && <Badge variant="outline">not offered</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell text-right tabular-nums">
                  ${formatMicros(row.listMicros)}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-right tabular-nums">
                  ${formatMicros(row.costMicros)}
                  {!row.fallbackOnly && (
                    <span className="text-muted-foreground ml-1 text-xs">direct</span>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-right tabular-nums">
                  {row.belowCost ? (
                    <Badge variant="destructive">below cost</Badge>
                  ) : row.margin ? (
                    `${row.margin.toFixed(2)}×`
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <PriceInput
                    country={row.country}
                    priceMicros={row.priceMicros}
                    saving={saving === row.country}
                    onSave={(priceUsd) => {
                      setSaving(row.country);
                      setRate.mutate({ country: row.country, priceUsd });
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
