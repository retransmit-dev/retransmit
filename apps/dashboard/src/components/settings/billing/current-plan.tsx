"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { formatDate } from "@/lib/format";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRightLeftIcon, CreditCardIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PlansDialog } from "./plans-dialog";

/** Statuses worth interrupting someone about, and what to say. */
const WARNINGS: Partial<Record<string, string>> = {
  past_due: "The last payment failed. Update the card to keep sending.",
  unpaid: "The subscription is unpaid and limits have dropped to Free.",
  incomplete: "The first payment has not gone through yet.",
  canceled: "The subscription was canceled and limits have dropped to Free.",
  paused: "The subscription is paused.",
};

export function CurrentPlan() {
  const { canManage } = useCurrentOrganization();
  const overview = useQuery(trpc.billing.overview.queryOptions());
  const [plansOpen, setPlansOpen] = useState(false);

  const portal = useMutation(
    trpc.billing.portal.mutationOptions({
      onSuccess: ({ url }) => {
        window.location.href = url;
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  // Checkout is what collects the first card, on the plan the organization is
  // already on, so it reads as "add a card" rather than a plan change. Free
  // charges nothing for it.
  const checkout = useMutation(
    trpc.billing.checkout.mutationOptions({
      onSuccess: ({ url }) => {
        window.location.href = url;
      },
    }),
  );

  if (overview.isLoading) return <Skeleton className="h-24 w-full" />;
  if (!overview.data) return null;

  const { plan, planName, status, cancelAtPeriodEnd, periodEnd } = overview.data;
  const { hasPaymentMethod, configured } = overview.data;
  const warning = WARNINGS[status];

  /**
   * Checkout can only create a subscription, so it is right exactly once: for
   * an organization that has never had one. After that a second session would
   * mean a second subscription, and the portal is where a card is replaced.
   */
  const addPaymentMethod = () =>
    status === "none" ? checkout.mutate({ plan }) : portal.mutate();

  return (
    <div className="flex flex-col gap-4">
      {/* Plan on the left, what to do about it on the right. */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-medium">{planName}</h2>
            {cancelAtPeriodEnd ? (
              <Badge variant="outline">Ends {formatDate(periodEnd)}</Badge>
            ) : (
              <Badge variant="outline">Renews {formatDate(periodEnd)}</Badge>
            )}
          </div>

          <p className="text-muted-foreground text-sm">
            {hasPaymentMethod
              ? "Overage, SMS and WhatsApp bill at the end of the period."
              : "Add a card for overage, SMS and WhatsApp."}
          </p>
        </div>

        {canManage && configured && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setPlansOpen(true)}>
              <ArrowRightLeftIcon />
              Change plan
            </Button>
            {hasPaymentMethod ? (
              <Button
                variant="outline"
                onClick={() => portal.mutate()}
                disabled={portal.isPending}
              >
                <CreditCardIcon />
                Payment and invoices
              </Button>
            ) : (
              <Button
                onClick={addPaymentMethod}
                disabled={checkout.isPending || portal.isPending}
              >
                <CreditCardIcon />
                Add payment method
              </Button>
            )}
          </div>
        )}
      </div>

      {warning && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Subscription needs attention</AlertTitle>
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      )}

      {!configured && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Billing is not configured</AlertTitle>
          <AlertDescription>
            This deployment has no Stripe key, so plans cannot be changed here.
          </AlertDescription>
        </Alert>
      )}

      <PlansDialog open={plansOpen} onOpenChange={setPlansOpen} />
    </div>
  );
}
