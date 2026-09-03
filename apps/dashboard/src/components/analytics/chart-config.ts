import type { ChartConfig } from "@/components/ui/chart";

export const METRICS = [
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
] as const;
export type Metric = (typeof METRICS)[number];
export type Totals = Record<Metric, number>;

/** One entity, one color, across tiles and every chart (tokens in globals.css). */
export const chartConfig = {
  sent: { label: "Sent", color: "var(--chart-sent)" },
  delivered: { label: "Delivered", color: "var(--chart-delivered)" },
  opened: { label: "Opened", color: "var(--chart-opened)" },
  clicked: { label: "Clicked", color: "var(--chart-clicked)" },
  bounced: { label: "Bounced", color: "var(--chart-bounced)" },
  complained: { label: "Complained", color: "var(--chart-complained)" },
} satisfies ChartConfig;

export const ZERO_COUNTS = Object.fromEntries(
  METRICS.map((metric) => [metric, 0]),
) as Totals;

/** One x-axis bucket with every metric filled in. */
export type SeriesPoint = Totals & { label: string; full: string };

export function rate(numerator: number, denominator: number): string {
  if (denominator === 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export const tooltipLabel = (
  _: unknown,
  payload?: readonly { payload?: { full?: string } }[],
) => payload?.[0]?.payload?.full ?? "";
