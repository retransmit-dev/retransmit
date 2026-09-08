"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { formatCents, formatCount } from "@/lib/money";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";

type Plan = {
  id: string;
  name: string;
  priceCents: number;
  includedEmails: number;
  overageCentsPer1K: number;
  domains: number;
  teamMembers: number;
  logRetentionDays: number;
  support: string;
};

function features(plan: Plan): string[] {
  return [
    `${formatCount(plan.includedEmails)} emails included`,
    `${formatCents(plan.overageCentsPer1K)} per 1,000 after that`,
    `${plan.domains} domain${plan.domains === 1 ? "" : "s"}`,
    `${plan.teamMembers} team member${plan.teamMembers === 1 ? "" : "s"}`,
    `${plan.logRetentionDays} day${plan.logRetentionDays === 1 ? "" : "s"} of logs`,
    `${plan.support} support`,
    "Pay as you go SMS and WhatsApp",
  ];
}

export function PlanPicker() {
  const queryClient = useQueryClient();
  const { canManage } = useCurrentOrganization();
  const plans = useQuery(trpc.billing.plans.queryOptions());
  const overview = useQuery(trpc.billing.overview.queryOptions());

  // An organization with no subscription goes through Checkout, which is what
  // collects the card; one that already has a card changes plan in place.
  const checkout = useMutation(
    trpc.billing.checkout.mutationOptions({
      onSuccess: ({ url }) => {
        window.location.href = url;
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const change = useMutation(
    trpc.billing.changePlan.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.billing.pathFilter());
        toast.success("Plan updated. The new limits apply right away.");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  if (plans.isLoading || overview.isLoading) {
    return <Skeleton className="h-64 w-full max-w-4xl" />;
  }
  if (!plans.data || !overview.data) return null;

  const { plan: currentPlan, hasPaymentMethod, configured } = overview.data;
  const pending = checkout.isPending || change.isPending;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Plans</h2>

      <div className="grid max-w-4xl gap-4 md:grid-cols-3">
        {plans.data.map((plan) => {
          const current = plan.id === currentPlan;
          return (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col gap-4 rounded-lg border p-5",
                current && "border-primary",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{plan.name}</span>
                {current && <Badge variant="outline">Current</Badge>}
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-medium">{formatCents(plan.priceCents)}</span>
                <span className="text-muted-foreground text-sm">/mo</span>
              </div>

              <ul className="flex flex-col gap-2 text-sm">
                {features(plan).map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <CheckIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    <span className="first-letter:uppercase">{feature}</span>
                  </li>
                ))}
              </ul>

              {canManage && configured && (
                <Button
                  className="mt-auto"
                  variant={current ? "outline" : "default"}
                  disabled={current || pending}
                  onClick={() =>
                    hasPaymentMethod
                      ? change.mutate({ plan: plan.id })
                      : checkout.mutate({ plan: plan.id })
                  }
                >
                  {current ? "Current plan" : hasPaymentMethod ? "Switch" : "Choose"}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {!hasPaymentMethod && (
        <p className="text-muted-foreground max-w-2xl text-sm">
          Choosing a plan opens Stripe Checkout. Free costs nothing, but still needs a card on
          file so email overage, SMS and WhatsApp can be billed.
        </p>
      )}
    </div>
  );
}
