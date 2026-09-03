"use client";

import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";

export function SuppressionStats() {
  const stats = useQuery(trpc.suppression.stats.queryOptions());

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <StatCard value={stats.data?.total} label="Total" />
      <StatCard value={stats.data?.bounce} label="Bounced" tone="text-red-500" />
      <StatCard
        value={stats.data?.complaint}
        label="Complained"
        tone="text-amber-500"
      />
      <StatCard value={stats.data?.unsubscribe} label="Unsubscribed" />
      <StatCard value={stats.data?.manual} label="Added manually" />
    </div>
  );
}

function StatCard({
  value,
  label,
  tone,
}: {
  value: number | undefined;
  label: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className={cn("text-2xl font-semibold tabular-nums", tone)}>
        {value ?? "–"}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
