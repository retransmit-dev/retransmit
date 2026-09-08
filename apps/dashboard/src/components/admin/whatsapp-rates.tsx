"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMicros } from "@/lib/money";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

type Category = "marketing" | "utility" | "authentication" | "service";

/**
 * WhatsApp rates, by destination and category.
 *
 * Two dimensions because Meta's price varies far more between marketing and
 * authentication than it does between countries. Unlike the SMS card this one
 * is not seeded: Meta publishes rates only through an interactive tool, so
 * inventing 984 country/category rows would be worse than having none. What is
 * listed here are overrides; everything else bills at the category default
 * shown above the table, which is a placeholder until real numbers are entered.
 */
export function WhatsappRatesTable() {
  const queryClient = useQueryClient();
  const rates = useQuery(trpc.admin.whatsappRates.queryOptions(undefined, { throwOnError: true }));

  const [country, setCountry] = useState("");
  const [category, setCategory] = useState<Category>("marketing");
  const [price, setPrice] = useState("");

  const invalidate = () =>
    void queryClient.invalidateQueries(trpc.admin.whatsappRates.pathFilter());

  const setRate = useMutation(
    trpc.admin.setWhatsappRate.mutationOptions({
      onSuccess: (_, variables) => {
        invalidate();
        toast.success(`${variables.country} ${variables.category} is now $${variables.priceUsd}`);
        setPrice("");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const clearRate = useMutation(
    trpc.admin.clearWhatsappRate.mutationOptions({
      onSuccess: () => {
        invalidate();
        toast.success("Override removed; the category default applies again");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  if (rates.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!rates.data) return null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const priceUsd = Number(price);
    if (!country) return toast.error("Pick a destination");
    if (!Number.isFinite(priceUsd) || priceUsd < 0) return toast.error("Enter a price in dollars");
    setRate.mutate({ country, category, priceUsd });
  };

  const names = new Map(rates.data.countries.map((entry) => [entry.code, entry]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {rates.data.defaults.map((entry) => (
          <Badge key={entry.category} variant="outline" className="capitalize">
            {entry.category} ${formatMicros(entry.priceMicros)}
          </Badge>
        ))}
        <span className="text-muted-foreground text-sm">
          Category defaults, used where no override exists. Placeholders until Meta&rsquo;s rate
          card is entered.
        </span>
      </div>

      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="wa-rate-country">Destination</Label>
          <Select value={country} onValueChange={(value) => setCountry(value ?? "")}>
            <SelectTrigger id="wa-rate-country" className="w-56">
              <SelectValue placeholder="Pick a country" />
            </SelectTrigger>
            <SelectContent>
              {rates.data.countries.map((entry) => (
                <SelectItem key={entry.code} value={entry.code}>
                  {entry.flag} {entry.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="wa-rate-category">Category</Label>
          <Select value={category} onValueChange={(value) => value && setCategory(value as Category)}>
            <SelectTrigger id="wa-rate-category" className="w-44 capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rates.data.defaults.map((entry) => (
                <SelectItem key={entry.category} value={entry.category} className="capitalize">
                  {entry.category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="wa-rate-price">Price per message (USD)</Label>
          <Input
            id="wa-rate-price"
            className="w-36 tabular-nums"
            inputMode="decimal"
            placeholder="0.0400"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </div>

        <Button type="submit" disabled={setRate.isPending}>
          Save rate
        </Button>
      </form>

      {rates.data.overrides.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No overrides yet. Every destination bills at its category default.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destination</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Price / message</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.data.overrides.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span aria-hidden>{names.get(row.country)?.flag ?? "🏳️"}</span>
                    <span>{names.get(row.country)?.name ?? row.country}</span>
                    <code className="text-muted-foreground font-mono text-xs">{row.country}</code>
                  </div>
                </TableCell>
                <TableCell className="capitalize">{row.category}</TableCell>
                <TableCell className="text-right tabular-nums">
                  ${formatMicros(row.priceMicros)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove the ${row.country} ${row.category} override`}
                    disabled={clearRate.isPending}
                    onClick={() => clearRate.mutate({ id: row.id })}
                  >
                    <Trash2Icon />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
