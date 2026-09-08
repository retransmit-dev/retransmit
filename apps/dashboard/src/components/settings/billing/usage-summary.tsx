"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { formatCents, formatCount } from "@/lib/money";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";

/** A labelled number with an optional second line of detail underneath. */
function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-2xl font-medium tabular-nums">{value}</span>
      {detail && <span className="text-muted-foreground text-sm">{detail}</span>}
    </div>
  );
}

export function UsageSummary() {
  const overview = useQuery(trpc.billing.overview.queryOptions());

  if (overview.isLoading) return <Skeleton className="h-40 w-full max-w-2xl" />;
  if (!overview.data) return null;

  const { usage, limits, periodStart, periodEnd } = overview.data;
  const used = Math.min(usage.emails, usage.includedEmails);
  const percent = Math.round((used / usage.includedEmails) * 100);
  // Whole thousands, rounded up, is how the overage rate is quoted and how
  // Stripe's graduated tier bills it.
  const overageCents = Math.ceil(usage.overageEmails / 1000) * usage.overageCentsPer1K;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">This period</h2>
        <p className="text-muted-foreground text-sm">
          {formatDate(periodStart)} to {formatDate(periodEnd)}
        </p>
      </div>

      <div className="grid max-w-2xl gap-6 sm:grid-cols-2">
        <Stat
          label="Emails"
          value={`${formatCount(usage.emails)} / ${formatCount(usage.includedEmails)}`}
          detail={
            usage.overageEmails > 0
              ? `${formatCount(usage.overageEmails)} over, about ${formatCents(overageCents)}`
              : `${percent}% of the included allowance`
          }
        />
        <Stat
          label="Domains"
          value={`${limits.domains.used} / ${limits.domains.limit}`}
          detail={`Logs kept ${limits.logRetentionDays} day${
            limits.logRetentionDays === 1 ? "" : "s"
          }`}
        />
        <Stat
          label="SMS"
          value={formatCents(usage.smsCents)}
          detail="Pay as you go, priced per destination"
        />
        <Stat
          label="WhatsApp"
          value={formatCents(usage.whatsappCents)}
          detail="Pay as you go, priced per destination"
        />
      </div>
    </div>
  );
}
