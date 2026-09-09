"use client";

import { ErrorBoundary } from "@/components/error-boundary";

import { CurrentPlan } from "./current-plan";
import { UsageSummary } from "./usage-summary";

/**
 * Billing, top to bottom: what the organization is on and how to manage it,
 * then what it has used per period. The plans themselves are a dialog, behind
 * "Change plan", because a page nobody reads twice should not be three columns
 * of pricing.
 */
export function BillingView() {
  return (
    <div className="flex flex-col gap-8">
      <ErrorBoundary title="Could not load the current plan">
        <CurrentPlan />
      </ErrorBoundary>
      <ErrorBoundary title="Could not load usage">
        <UsageSummary />
      </ErrorBoundary>
    </div>
  );
}
