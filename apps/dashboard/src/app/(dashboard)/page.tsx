"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  eachDayOfInterval,
  eachHourOfInterval,
  endOfDay,
  format,
  startOfDay,
  subDays,
} from "date-fns";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import { DateRangePicker } from "@/components/date-range-picker";
import { PageHeader, PageShell } from "@/components/page-shell";
import type { DateRange } from "@/components/date-range-picker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

const METRICS = [
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
] as const;
type Metric = (typeof METRICS)[number];
type Totals = Record<Metric, number>;

/** One entity, one color, across tiles and every chart (tokens in globals.css). */
const chartConfig = {
  sent: { label: "Sent", color: "var(--chart-sent)" },
  delivered: { label: "Delivered", color: "var(--chart-delivered)" },
  opened: { label: "Opened", color: "var(--chart-opened)" },
  clicked: { label: "Clicked", color: "var(--chart-clicked)" },
  bounced: { label: "Bounced", color: "var(--chart-bounced)" },
  complained: { label: "Complained", color: "var(--chart-complained)" },
} satisfies ChartConfig;

const ZERO_COUNTS = Object.fromEntries(
  METRICS.map((metric) => [metric, 0]),
) as Totals;

function defaultRange(): DateRange {
  return { from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) };
}

function rate(numerator: number, denominator: number): string {
  if (denominator === 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function StatTile({
  metric,
  value,
  caption,
}: {
  metric: Metric;
  value: number;
  caption?: string;
}) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ background: chartConfig[metric].color }}
          />
          {chartConfig[metric].label}
        </p>
        <p className="text-2xl font-semibold">{value.toLocaleString()}</p>
        {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
      </CardContent>
    </Card>
  );
}

const tooltipLabel = (
  _: unknown,
  payload?: readonly { payload?: { full?: string } }[],
) => payload?.[0]?.payload?.full ?? "";

export default function AnalyticsPage() {
  const [domainId, setDomainId] = useState<string>("all");
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [timeZone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  const domains = useQuery(trpc.domain.list.queryOptions());
  const overview = useQuery(
    trpc.analytics.overview.queryOptions(
      {
        from: range.from,
        to: range.to,
        domainId: domainId === "all" ? undefined : domainId,
        timeZone,
      },
      { placeholderData: keepPreviousData },
    ),
  );

  const domainItems = [
    { value: "all", label: "All domains" },
    ...(domains.data ?? []).map((row) => ({ value: row.id, label: row.name })),
  ];

  // The server returns only non-empty buckets; fill the gaps so the x-axis
  // covers the whole selected window.
  const data = useMemo(() => {
    if (!overview.data) return [];
    const byBucket = new Map(
      overview.data.series.map((row) => [row.bucket, row]),
    );
    const hourly = overview.data.interval === "hour";
    // Don't chart hours that haven't happened yet.
    const now = new Date();
    const end = hourly && range.to > now ? now : range.to;
    const ticks = hourly
      ? eachHourOfInterval({ start: range.from, end })
      : eachDayOfInterval({ start: range.from, end: range.to });
    return ticks.map((tick) => ({
      label: format(tick, hourly ? "ha" : "MMM d"),
      full: format(tick, hourly ? "MMM d, ha" : "MMM d, yyyy"),
      ...ZERO_COUNTS,
      ...byBucket.get(format(tick, hourly ? "yyyy-MM-dd'T'HH" : "yyyy-MM-dd")),
    }));
  }, [overview.data, range]);

  const totals = overview.data?.totals ?? ZERO_COUNTS;

  return (
    <PageShell>
      <PageHeader
        href="/"
        actions={
          <>
            <Select
              items={domainItems}
              value={domainId}
              onValueChange={(value) => setDomainId(value as string)}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {domainItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateRangePicker value={range} onChange={setRange} />
          </>
        }
      />

      {overview.isLoading ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {METRICS.map((metric) => (
              <Skeleton key={metric} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-col gap-4 transition-opacity",
            overview.isFetching && "opacity-60",
          )}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile metric="sent" value={totals.sent} />
            <StatTile
              metric="delivered"
              value={totals.delivered}
              caption={`${rate(totals.delivered, totals.sent)} of sent`}
            />
            <StatTile
              metric="opened"
              value={totals.opened}
              caption={`${rate(totals.opened, totals.delivered)} of delivered`}
            />
            <StatTile
              metric="clicked"
              value={totals.clicked}
              caption={`${rate(totals.clicked, totals.delivered)} of delivered`}
            />
            <StatTile
              metric="bounced"
              value={totals.bounced}
              caption={`${rate(totals.bounced, totals.sent)} of sent`}
            />
            <StatTile
              metric="complained"
              value={totals.complained}
              caption={`${rate(totals.complained, totals.sent)} of sent`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Volume</CardTitle>
              <CardDescription>
                Emails sent, delivered, and opened.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={chartConfig}
                className="aspect-auto h-64 w-full"
              >
                <BarChart
                  data={data}
                  margin={{ left: 0, right: 12 }}
                  barGap={2}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    width={36}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent labelFormatter={tooltipLabel} />
                    }
                  />
                  <ChartLegend
                    itemSorter={null}
                    content={<ChartLegendContent />}
                  />
                  {(["sent", "delivered", "opened"] as const).map((metric) => (
                    <Bar
                      key={metric}
                      dataKey={metric}
                      fill={`var(--color-${metric})`}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={16}
                    />
                  ))}
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Engagement</CardTitle>
                <CardDescription>
                  Distinct emails delivered, opened, and clicked.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={chartConfig}
                  className="aspect-auto h-64 w-full"
                >
                  <LineChart data={data} margin={{ left: 0, right: 12 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      width={36}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          indicator="line"
                          labelFormatter={tooltipLabel}
                        />
                      }
                    />
                    <ChartLegend
                      itemSorter={null}
                      content={<ChartLegendContent />}
                    />
                    {(["delivered", "opened", "clicked"] as const).map(
                      (metric) => (
                        <Line
                          key={metric}
                          dataKey={metric}
                          type="monotone"
                          stroke={`var(--color-${metric})`}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{
                            r: 4,
                            stroke: "var(--card)",
                            strokeWidth: 2,
                          }}
                        />
                      ),
                    )}
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Deliverability issues</CardTitle>
                <CardDescription>Bounces and spam complaints.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={chartConfig}
                  className="aspect-auto h-64 w-full"
                >
                  <BarChart data={data} margin={{ left: 0, right: 12 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      width={36}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent labelFormatter={tooltipLabel} />
                      }
                    />
                    <ChartLegend
                      itemSorter={null}
                      content={<ChartLegendContent />}
                    />
                    <Bar
                      dataKey="bounced"
                      stackId="issues"
                      fill="var(--color-bounced)"
                      stroke="var(--card)"
                      strokeWidth={1}
                      maxBarSize={24}
                    />
                    <Bar
                      dataKey="complained"
                      stackId="issues"
                      fill="var(--color-complained)"
                      stroke="var(--card)"
                      strokeWidth={1}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={24}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PageShell>
  );
}
