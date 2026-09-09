import { QUEUES, getBoss } from "@retransmit/queue";

import { isSelfHostedMode } from "./mode";
import { refreshSmsCosts, seedSmsRates, seedWhatsappRates } from "./rates";
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

  // Self-hosters pay their configured providers directly. They need neither a
  // customer rate card nor a Stripe reconciliation worker.
  if (isSelfHostedMode()) return;

  if (!isBillingConfigured()) {
    throw new Error("RETRANSMIT_MODE=cloud requires STRIPE_SECRET_KEY");
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("RETRANSMIT_MODE=cloud requires STRIPE_WEBHOOK_SECRET");
  }

  // The SMS rate card seeds itself so a fresh database prices every
  // destination without an operator having to fill in 246 rows. Existing rows
  // are never overwritten, so this is a no-op after the first boot; only the
  // cost column follows AWS's current list, and that is display-only.
  try {
    const seeded = await seedSmsRates();
    const seededWhatsapp = await seedWhatsappRates();
    if (seeded > 0 || seededWhatsapp > 0) {
      console.log(`[billing] seeded ${seeded} SMS rates, ${seededWhatsapp} WhatsApp overrides`);
    }
    await refreshSmsCosts();
  } catch (error) {
    // A rate-card problem must not stop the API from booting: sends still
    // price off the AWS-derived default when the table is empty.
    console.error("[billing] could not seed SMS rates", error);
  }

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
