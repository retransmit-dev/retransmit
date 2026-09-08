"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/status-badges";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";

/**
 * SMS routing as it stands in this deployment. Read-only on purpose: routing
 * picks the cheapest configured provider that covers the destination, and
 * turning that into a screen with switches would make an internal cost
 * decision look like a customer setting. Customers see sender ids; operators
 * see this.
 */
export function SmsProvidersTable() {
  const providers = useQuery(trpc.admin.smsProviders.queryOptions(undefined, { throwOnError: true }));

  if (providers.isLoading) {
    return (
      <div className="grid gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Provider</TableHead>
          <TableHead>Configured</TableHead>
          <TableHead className="hidden sm:table-cell">Covers</TableHead>
          <TableHead className="hidden sm:table-cell">Public name</TableHead>
          <TableHead className="text-right">USD / segment</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {providers.data?.map((row) => (
          <TableRow key={row.key} className={row.configured ? undefined : "opacity-60"}>
            <TableCell className="font-medium">
              {row.name}
              <span className="block font-mono text-xs font-normal text-muted-foreground">
                {row.key}
              </span>
            </TableCell>
            <TableCell>
              <Badge variant="outline">
                <StatusDot className={row.configured ? "bg-emerald-500" : "bg-zinc-400"} />
                {row.configured ? "Yes" : "Missing credentials"}
              </Badge>
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              {/* null means a global aggregator: it quotes every destination,
                  which is what makes it the fallback. */}
              {row.countries === null ? (
                <span className="text-muted-foreground">Everywhere</span>
              ) : (
                <span className="flex flex-wrap gap-1">
                  {row.countries.map((code) => (
                    <Badge key={code} variant="secondary" className="font-normal">
                      {code}
                    </Badge>
                  ))}
                </span>
              )}
            </TableCell>
            <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
              {row.family}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.costUsd === null ? "—" : row.costUsd.toFixed(4)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
