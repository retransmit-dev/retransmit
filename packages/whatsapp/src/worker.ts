import { QUEUES, getBoss } from "@retransmit/queue";
import type { WhatsappSendJob } from "@retransmit/queue";

import { markWhatsappPermanentlyFailed, processWhatsappSend } from "./send-job";

/**
 * Sends per second toward upstream WhatsApp providers. Meta's Cloud API
 * default throughput is 80 messages/s per number; stay well under it.
 */
const sendRate = Math.max(1, Number(process.env.WHATSAPP_MAX_SEND_RATE ?? 20));

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
 * Registers the WhatsApp queue workers on the shared pg-boss instance. Called
 * once at API server boot (instrumentation.ts). Safe to call again — a no-op.
 */
export async function startWhatsappWorkers(): Promise<void> {
  if (workersStarted) return;
  workersStarted = true;

  const boss = await getBoss();
  const pace = createPacer(sendRate);

  await boss.work<WhatsappSendJob>(
    QUEUES.whatsappSend,
    { batchSize: Math.ceil(sendRate), perJobResults: true },
    async (jobs) => {
      const results = [];
      for (const job of jobs) {
        await pace();
        try {
          await processWhatsappSend(job.data.messageId);
          results.push({ id: job.id, status: "completed" as const });
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause);
          results.push({ id: job.id, status: "failed" as const, output: { message } });
        }
      }
      return results;
    },
  );

  await boss.work<WhatsappSendJob>(QUEUES.whatsappSendDead, async (jobs) => {
    for (const job of jobs) {
      console.error(`[worker] whatsapp ${job.data.messageId} dead-lettered after all retries`);
      await markWhatsappPermanentlyFailed(job.data.messageId);
    }
  });

  console.log(`[worker] whatsapp workers started (send rate: ${sendRate}/s)`);
}
