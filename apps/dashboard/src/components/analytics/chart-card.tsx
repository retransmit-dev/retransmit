"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { chartConfig } from "./chart-config";

/** The frame every overview chart shares: title, loading and refetch states. */
export function ChartCard({
  title,
  description,
  loading,
  fetching,
  children,
}: {
  title: string;
  description: string;
  loading: boolean;
  fetching: boolean;
  children: React.ComponentProps<typeof ChartContainer>["children"];
}) {
  return (
    <Card className={cn("transition-opacity", fetching && !loading && "opacity-60")}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
            {children}
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
