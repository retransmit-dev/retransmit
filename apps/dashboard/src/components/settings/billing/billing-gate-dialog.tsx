"use client";

import { getBillingGate, requestBillingGate, subscribeToBillingGate } from "@/lib/billing-gate";
import { useSyncExternalStore } from "react";

import { PaymentMethodDialog } from "./payment-method-dialog";
import { PlansDialog } from "./plans-dialog";

/**
 * Mounted once for the whole dashboard. A mutation refused by a billing check
 * raises it from the mutation cache, and the fix opens over whatever the person
 * was doing: the plans when a bigger one would cover it, the card when the
 * organization has none and the work would bill it.
 */
export function BillingGateDialog() {
  // Nothing is pending on the server, so both dialogs render closed until the
  // browser takes over.
  const gate = useSyncExternalStore(subscribeToBillingGate, getBillingGate, () => null);
  const close = (open: boolean) => {
    if (!open) requestBillingGate(null);
  };

  if (gate?.kind === "payment_method") {
    return <PaymentMethodDialog open onOpenChange={close} reason={gate.message} />;
  }

  return <PlansDialog open={gate !== null} onOpenChange={close} reason={gate?.message} />;
}
