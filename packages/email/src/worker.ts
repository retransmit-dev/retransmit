import { QUEUES, getBoss } from "@retransmit/queue";
import type { EmailSendJob, WebhookDispatchJob } from "@retransmit/queue";

import { markEmailPermanentlyFailed, processEmailSend } from "./send-job";
import { deliverWebhookJob } from "./webhooks";

/**
 * Sends per second we allow toward SES. Must stay at or below the account's
 * SES sending rate (1/s in sandbox, ~14/s on fresh production access).
 */
const sendRate = Math.max(1, Number(process.env.SES_MAX_SEND_RATE ?? 14));

/** Evenly paces calls: resolves when the next send slot is free. */
function createPacer(perSecond: number) {
  const interval = 1000 / perSecond;
  let next = 0;
  return async () => {
    const now = Date.now();
    const wait = Math.max(0, next - now);
    next = Math.max(now, next) + interval;
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  };
}

let workersStarted = false;

/**
 * Registers the queue workers on the shared pg-boss instance. Called once at
 * API server boot (instrumentation.ts). Safe to call again — a no-op.
 */
export async function startEmailWorkers(): Promise<void> {
  if (workersStarted) return;
  workersStarted = true;

  const boss = await getBoss();
  const pace = createPacer(sendRate);

  // Throttled sender. Jobs succeed or fail individually; failures retry with
  // backoff and dead-letter after the queue's retryLimit.
  await boss.work<EmailSendJob>(
    QUEUES.emailSend,
    { batchSize: Math.ceil(sendRate), perJobResults: true },
    async (jobs) => {
      const results = [];
      for (const job of jobs) {
        await pace();
        try {
          await processEmailSend(job.data.emailId);
          results.push({ id: job.id, status: "completed" as const });
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause);
          results.push({ id: job.id, status: "failed" as const, output: { message } });
        }
      }
      return results;
    },
  );

  await boss.work<EmailSendJob>(QUEUES.emailSendDead, async (jobs) => {
    for (const job of jobs) {
      console.error(`[worker] email ${job.data.emailId} dead-lettered after all retries`);
      await markEmailPermanentlyFailed(job.data.emailId);
    }
  });

  await boss.work<WebhookDispatchJob>(
    QUEUES.webhookDispatch,
    { batchSize: 10, perJobResults: true },
    async (jobs) => {
      const results = [];
      for (const job of jobs) {
        try {
          await deliverWebhookJob(job.data);
          results.push({ id: job.id, status: "completed" as const });
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause);
          results.push({ id: job.id, status: "failed" as const, output: { message } });
        }
      }
      return results;
    },
  );

  await boss.work<WebhookDispatchJob>(QUEUES.webhookDispatchDead, async (jobs) => {
    // Attempts are already recorded as webhook_delivery rows; just log.
    for (const job of jobs) {
      console.error(
        `[worker] webhook ${job.data.eventType} to endpoint ${job.data.endpointId} dead-lettered`,
      );
    }
  });

  console.log(`[worker] email workers started (send rate: ${sendRate}/s)`);
}
