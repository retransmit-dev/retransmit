"use client";

import { getUpgradeReason, requestUpgrade, subscribeToUpgrade } from "@/lib/upgrade";
import { useSyncExternalStore } from "react";

import { PlansDialog } from "./plans-dialog";

/**
 * Mounted once for the whole dashboard. A mutation refused by a plan limit
 * raises the reason from the mutation cache, and the plans open over whatever
 * the person was doing, because that is the only way past it.
 */
export function UpgradeDialog() {
  // Nothing is pending on the server, so the dialog renders closed until the
  // browser takes over.
  const reason = useSyncExternalStore(subscribeToUpgrade, getUpgradeReason, () => null);

  return (
    <PlansDialog
      open={reason !== null}
      onOpenChange={(open) => {
        if (!open) requestUpgrade(null);
      }}
      reason={reason ?? undefined}
    />
  );
}
