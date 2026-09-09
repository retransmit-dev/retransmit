"use client";

import { Badge } from "@/components/ui/badge";
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
import { formatCents, formatCount } from "@/lib/money";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";

/**
 * What the emails column says under the count, once a period is past its
 * allowance. Under it, `0 / 1,000` has said everything already.
 */
function overageDetail(
  emails: number,
  included: number,
  overageCentsPer1K: number,
): string | null {
  const over = Math.max(0, emails - included);
  if (over === 0) return null;
  // Whole thousands, rounded up, is how the overage rate is quoted and how
  // Stripe's graduated tier bills it.
  const cents = Math.ceil(over / 1000) * overageCentsPer1K;
  return `${formatCount(over)} over, about ${formatCents(cents)}`;
}

export function UsageSummary() {
  const overview = useQuery(trpc.billing.overview.queryOptions());
  const usage = useQuery(trpc.billing.usage.queryOptions());

  if (usage.isLoading) return <Skeleton className="h-48 w-full" />;
  if (!usage.data) return null;

  const { periods, includedEmails, overageCentsPer1K } = usage.data;
  const limits = overview.data?.limits;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Usage</h2>

      <Table>
        <TableHeader>
          <TableRow>
            {/* The period takes the slack so the three figures stay a group. */}
            <TableHead className="w-full">Period</TableHead>
            <TableHead className="min-w-48 text-right">Emails</TableHead>
            <TableHead className="min-w-24 text-right">SMS</TableHead>
            <TableHead className="min-w-24 text-right">WhatsApp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {periods.map((period) => {
            const overage = overageDetail(period.emails, includedEmails, overageCentsPer1K);
            return (
              <TableRow key={String(period.periodStart)}>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {formatDate(period.periodStart)} to {formatDate(period.periodEnd)}
                    </span>
                    {period.current && <Badge variant="outline">Current</Badge>}
                  </div>
                </TableCell>
                {/* The allowance sits with the number it is about. */}
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  {period.current
                    ? `${formatCount(period.emails)} / ${formatCount(includedEmails)}`
                    : formatCount(period.emails)}
                  {overage && (
                    <p className="text-muted-foreground text-sm font-normal">{overage}</p>
                  )}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  {formatCents(period.smsCents)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  {formatCents(period.whatsappCents)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {limits && (
        <p className="text-muted-foreground text-sm">
          Domains {limits.domains.used} / {limits.domains.limit}. Team members{" "}
          {limits.teamMembers.used} / {limits.teamMembers.limit}. Logs kept{" "}
          {limits.logRetentionDays} day{limits.logRetentionDays === 1 ? "" : "s"}.
        </p>
      )}
    </div>
  );
}
