import { endOfDay, startOfDay, subDays } from "date-fns";

import type { DateRange } from "@/components/date-range-picker";

/** Whole days from `daysBack` days ago through the end of today. */
export function recentRange(daysBack: number): DateRange {
  const now = new Date();
  return { from: startOfDay(subDays(now, daysBack)), to: endOfDay(now) };
}
