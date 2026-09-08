import { QUEUES, getBoss } from "@retransmit/queue";

import { isBillingConfigured } from "./stripe";
import { reportUnbilledUsage } from "./usage";

let workersStarted = false;

/**
 * Pushes usage that a failed Stripe meter call left behind.
 *
 * `recordUsage` writes the local counter first and only then reports to the
 * meter, so a Stripe outage costs accuracy on the invoice rather than dropping
 * a send. This is what makes that recoverable: hourly, every row whose
 * `reportedQuantity` is short of its `quantity` sends the difference. Meter
 * aggregation is a sum and only the outstanding amount is ever sent, so a run
 * that overlaps another cannot double-bill.
 *
 * Called once at API server boot (instrumentation.ts). Safe to call again.
 */
export async function startBillingWorkers(): Promise<void> {
  if (workersStarted) return;
  workersStarted = true;

  // Nothing to reconcile against without a Stripe key.
  if (!isBillingConfigured()) return;

  const boss = await getBoss();

  await boss.work(QUEUES.billingReconcile, async () => {
    const reported = await reportUnbilledUsage();
    if (reported > 0) console.log(`[billing] reported ${reported} unbilled usage rows`);
  });

  // `singletonKey` keeps a second API instance from queueing the same run.
  await boss.schedule(QUEUES.billingReconcile, "0 * * * *", null, {
    singletonKey: "billing-reconcile",
  });
}
