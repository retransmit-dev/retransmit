"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { formatCents, formatCount } from "@/lib/money";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, TriangleAlertIcon } from "lucide-react";
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

/**
 * The plans, and the button that moves between them. Only mounted while the
 * dialog is open, so its queries run when someone actually asks for a plan
 * rather than on every page that could raise one.
 */
function PlanGrid({ onSwitched }: { onSwitched: () => void }) {
  const queryClient = useQueryClient();
  const { canManage } = useCurrentOrganization();
  const plans = useQuery(trpc.billing.plans.queryOptions());
  const overview = useQuery(trpc.billing.overview.queryOptions());

  // An organization with no subscription goes through Checkout, which creates
  // one and collects the card; anything else is changed in place, since a
  // second Checkout session would mean a second subscription.
  const checkout = useMutation(
    trpc.billing.checkout.mutationOptions({
      onSuccess: ({ url }) => {
        window.location.href = url;
      },
    }),
  );

  const change = useMutation(
    trpc.billing.changePlan.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.billing.pathFilter());
        toast.success("Plan updated. The new limits apply right away.");
        onSwitched();
      },
    }),
  );

  if (plans.isLoading || overview.isLoading) return <Skeleton className="h-72 w-full" />;
  if (!plans.data || !overview.data) return null;

  const { plan: currentPlan, status, configured } = overview.data;
  const subscribed = status !== "none";
  const pending = checkout.isPending || change.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
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
                    subscribed
                      ? change.mutate({ plan: plan.id })
                      : checkout.mutate({ plan: plan.id })
                  }
                >
                  {current ? "Current plan" : subscribed ? "Switch" : "Choose"}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {!canManage && (
        <p className="text-muted-foreground text-sm">
          Only owners and admins can change the plan.
        </p>
      )}

      {canManage && !configured && (
        <p className="text-muted-foreground text-sm">
          This deployment has no Stripe key, so plans cannot be changed here.
        </p>
      )}

      {canManage && configured && !subscribed && (
        <p className="text-muted-foreground text-sm">
          Opens Stripe Checkout. Free costs nothing, but still needs a card for overage, SMS
          and WhatsApp.
        </p>
      )}
    </div>
  );
}

/**
 * The plans, in a dialog. Opened from the billing page, and on its own whenever
 * a plan limit stops something (see `UpgradeDialog`).
 */
export function PlansDialog({
  open,
  onOpenChange,
  reason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What was refused, when the dialog opened because of a limit. */
  reason?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{reason ? "Upgrade to continue" : "Plans"}</DialogTitle>
          <DialogDescription>
            {reason ? "The current plan does not cover this." : "Changes apply right away."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {reason && (
            <Alert>
              <TriangleAlertIcon />
              <AlertDescription>{reason}</AlertDescription>
            </Alert>
          )}
          <PlanGrid onSwitched={() => onOpenChange(false)} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
