"use client";

import { ErrorBoundary } from "@/components/error-boundary";

import { CurrentPlan } from "./current-plan";
import { PlanPicker } from "./plan-picker";
import { UsageSummary } from "./usage-summary";

/**
 * Billing, top to bottom: what the organization is on and how to manage it,
 * what it has used this period, then the plans it could move to.
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
      <ErrorBoundary title="Could not load plans">
        <PlanPicker />
      </ErrorBoundary>
    </div>
  );
}
