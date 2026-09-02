import { QUEUES, getBoss } from "@retransmit/queue";
import type { SmsSendJob } from "@retransmit/queue";

import { markSmsPermanentlyFailed, processSmsSend } from "./send-job";

/** Sends per second toward upstream SMS providers. */
const sendRate = Math.max(1, Number(process.env.SMS_MAX_SEND_RATE ?? 10));

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
 * Registers the SMS queue workers on the shared pg-boss instance. Called once
 * at API server boot (instrumentation.ts). Safe to call again — a no-op.
 */
export async function startSmsWorkers(): Promise<void> {
  if (workersStarted) return;
  workersStarted = true;

  const boss = await getBoss();
  const pace = createPacer(sendRate);

  await boss.work<SmsSendJob>(
    QUEUES.smsSend,
    { batchSize: Math.ceil(sendRate), perJobResults: true },
    async (jobs) => {
      const results = [];
      for (const job of jobs) {
        await pace();
        try {
          await processSmsSend(job.data.smsId);
          results.push({ id: job.id, status: "completed" as const });
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause);
          results.push({ id: job.id, status: "failed" as const, output: { message } });
        }
      }
      return results;
    },
  );

  await boss.work<SmsSendJob>(QUEUES.smsSendDead, async (jobs) => {
    for (const job of jobs) {
      console.error(`[worker] sms ${job.data.smsId} dead-lettered after all retries`);
      await markSmsPermanentlyFailed(job.data.smsId);
    }
  });

  console.log(`[worker] sms workers started (send rate: ${sendRate}/s)`);
}
