"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BOUNCE_REASON_LABELS, providerLabel } from "@/lib/deliverability";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { rate } from "./chart-config";
import type { AnalyticsFilters } from "./use-overview";

/**
 * Below this many sends a provider's rates swing on single emails, so the
 * comparison the table exists for would mislead more than it informs.
 */
const MIN_VOLUME_FOR_RATES = 20;

/**
 * Deliverability split by who runs the recipient's mailbox.
 *
 * No provider tells a sender whether a message reached the inbox or the spam
 * folder, so the useful signal is comparative: a provider whose open rate
 * sits well below the others, on similar volume, is filtering us into junk.
 * The bounce reasons next to it say whether that is our reputation, our
 * authentication, or simply dead addresses.
 */
export function ProviderTable({ filters }: { filters: AnalyticsFilters }) {
  const query = useQuery(
    trpc.analytics.byProvider.queryOptions(
      {
        from: filters.range.from,
        to: filters.range.to,
        domainId: filters.domainId === "all" ? undefined : filters.domainId,
      },
      { placeholderData: keepPreviousData },
    ),
  );
  const rows = query.data ?? [];

  return (
    <Card
      className={cn(
        "transition-opacity",
        query.isFetching && !query.isLoading && "opacity-60",
      )}
    >
      <CardHeader>
        <CardTitle>Mailbox providers</CardTitle>
        <CardDescription>
          Where your recipients read mail, from the MX records of their domain.
          No provider reports spam-folder placement, so compare open rates: one
          provider well below the rest is filtering you into junk.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No sends with a resolved mailbox provider in this range.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-full">Provider</TableHead>
                  <TableHead className="min-w-20 text-right">Sent</TableHead>
                  <TableHead className="min-w-24 text-right">Delivered</TableHead>
                  <TableHead className="min-w-24 text-right">Opened</TableHead>
                  <TableHead className="min-w-24 text-right">Bounced</TableHead>
                  <TableHead className="min-w-48">Top bounce reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const thin = row.sent < MIN_VOLUME_FOR_RATES;
                  const top = row.bounceReasons[0];
                  const reason = top ? BOUNCE_REASON_LABELS[top.reason] : undefined;
                  return (
                    <TableRow key={row.provider}>
                      <TableCell className="font-medium">
                        {providerLabel(row.provider)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.sent.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {thin ? "—" : rate(row.delivered, row.sent)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          !thin && row.delivered > 0 && "font-medium",
                        )}
                      >
                        {thin ? "—" : rate(row.opened, row.delivered)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {thin ? "—" : rate(row.bounced, row.sent)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {top && reason ? (
                          <Tooltip>
                            <TooltipTrigger className="text-left underline decoration-dotted underline-offset-4">
                              {reason.label} ({top.count})
                            </TooltipTrigger>
                            <TooltipContent className="max-w-72">
                              {reason.hint}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="mt-3 text-xs text-muted-foreground">
              Rates are hidden below {MIN_VOLUME_FOR_RATES} sends, where a
              single email moves them too far to compare.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
