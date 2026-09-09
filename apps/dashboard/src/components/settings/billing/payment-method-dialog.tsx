"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { CreditCardIcon, TriangleAlertIcon } from "lucide-react";

import { usePaymentMethod } from "./use-payment-method";

/**
 * The button, and what to say when there is no button to show. Split out so
 * `billing.overview` is only queried while the dialog is open.
 */
function AddPaymentMethod() {
  const { canManage } = useCurrentOrganization();
  const { overview, configured, pending, addPaymentMethod } = usePaymentMethod();

  if (overview.isLoading) return <Skeleton className="h-9 w-44" />;
  if (!overview.data) return null;

  if (!canManage) {
    return (
      <p className="text-muted-foreground text-sm">
        Only owners and admins can add a payment method.
      </p>
    );
  }

  if (!configured) {
    return (
      <p className="text-muted-foreground text-sm">
        This deployment has no Stripe key, so a card cannot be added here.
      </p>
    );
  }

  return (
    <Button onClick={addPaymentMethod} disabled={pending}>
      <CreditCardIcon />
      Add payment method
    </Button>
  );
}

/**
 * Raised when something was refused for want of a card. Opened on its own by
 * `BillingGateDialog`, over whatever the person was doing, because adding the
 * card is the only way past it.
 */
export function PaymentMethodDialog({
  open,
  onOpenChange,
  reason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What was refused, from the check that refused it. */
  reason: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a payment method</DialogTitle>
          <DialogDescription>
            Nothing is charged now. The card is what the usage bills against.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Alert>
            <TriangleAlertIcon />
            <AlertDescription>{reason}</AlertDescription>
          </Alert>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <AddPaymentMethod />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
