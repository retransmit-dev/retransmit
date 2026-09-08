"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { formatDate } from "@/lib/format";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CreditCardIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

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

  const portal = useMutation(
    trpc.billing.portal.mutationOptions({
      onSuccess: ({ url }) => {
        window.location.href = url;
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  if (overview.isLoading) return <Skeleton className="h-32 w-full max-w-2xl" />;
  if (!overview.data) return null;

  const { planName, status, hasPaymentMethod, cancelAtPeriodEnd, periodEnd, configured } =
    overview.data;
  const warning = WARNINGS[status];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-medium">{planName}</h2>
        {cancelAtPeriodEnd ? (
          <Badge variant="outline">Ends {formatDate(periodEnd)}</Badge>
        ) : (
          <Badge variant="outline">Renews {formatDate(periodEnd)}</Badge>
        )}
        {!hasPaymentMethod && <Badge variant="outline">No payment method</Badge>}
      </div>

      <p className="text-muted-foreground max-w-2xl text-sm">
        {hasPaymentMethod
          ? "Emails past the included allowance, SMS and WhatsApp are billed monthly at the end of the period."
          : "Add a payment method to send past the included emails, and to use SMS and WhatsApp."}
      </p>

      {warning && (
        <Alert variant="destructive" className="max-w-2xl">
          <TriangleAlertIcon />
          <AlertTitle>Subscription needs attention</AlertTitle>
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      )}

      {!configured && (
        <Alert className="max-w-2xl">
          <TriangleAlertIcon />
          <AlertTitle>Billing is not configured</AlertTitle>
          <AlertDescription>
            This deployment has no Stripe key, so plans cannot be changed here.
          </AlertDescription>
        </Alert>
      )}

      {canManage && configured && hasPaymentMethod && (
        <div>
          <Button
            variant="outline"
            onClick={() => portal.mutate()}
            disabled={portal.isPending}
          >
            <CreditCardIcon />
            Manage payment and invoices
          </Button>
        </div>
      )}
    </div>
  );
}
