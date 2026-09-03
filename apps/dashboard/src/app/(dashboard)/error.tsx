"use client";

import { ErrorFallback } from "@/components/error-boundary";

/**
 * The last line of defence for a screen. Section boundaries catch almost
 * everything first; this only shows when a page itself throws, and even then
 * the sidebar and navigation stay up.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Could not load this page" />;
}
