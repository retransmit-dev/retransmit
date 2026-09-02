import { PgBoss } from "pg-boss";

/**
 * Queue names. Each work queue has a matching dead-letter queue that jobs
 * land on after exhausting their retries.
 */
export const QUEUES = {
  emailSend: "email-send",
  emailSendDead: "email-send-dead",
  webhookDispatch: "webhook-dispatch",
  webhookDispatchDead: "webhook-dispatch-dead",
} as const;

/** Job payload for `email-send` (and its dead-letter queue). */
export interface EmailSendJob {
  emailId: string;
}

/** Job payload for `webhook-dispatch` (and its dead-letter queue). */
export interface WebhookDispatchJob {
  endpointId: string;
  eventType: string;
  /** Pre-serialized event body — signed verbatim, so it must not be re-encoded. */
  body: string;
}

const SEND_RETRY = {
  retryLimit: 5,
  retryDelay: 5, // seconds; with backoff: ~5s, 10s, 20s, 40s, 80s
  retryBackoff: true,
} as const;

const WEBHOOK_RETRY = {
  retryLimit: 8,
  retryDelay: 10,
  retryBackoff: true,
  retryDelayMax: 3600,
} as const;

let boss: PgBoss | undefined;
let started: Promise<PgBoss> | undefined;

/**
 * Returns the started pg-boss instance (lazily creating queues on first use).
 * pg-boss keeps its own tables in the `pgboss` schema of DATABASE_URL.
 */
export function getBoss(): Promise<PgBoss> {
  started ??= (async () => {
    boss = new PgBoss({
      connectionString: process.env.DATABASE_URL as string,
      schema: "pgboss",
    });
    boss.on("error", (error) => console.error("[queue] pg-boss error", error));
    await boss.start();

    await boss.createQueue(QUEUES.emailSendDead);
    await boss.createQueue(QUEUES.emailSend, {
      ...SEND_RETRY,
      deadLetter: QUEUES.emailSendDead,
    });
    await boss.createQueue(QUEUES.webhookDispatchDead);
    await boss.createQueue(QUEUES.webhookDispatch, {
      ...WEBHOOK_RETRY,
      deadLetter: QUEUES.webhookDispatchDead,
    });

    return boss;
  })();
  return started;
}

export async function stopBoss(): Promise<void> {
  if (!boss) return;
  await boss.stop({ graceful: true });
  boss = undefined;
  started = undefined;
}

export async function enqueueEmailSend(emailId: string): Promise<void> {
  const instance = await getBoss();
  await instance.send(QUEUES.emailSend, { emailId } satisfies EmailSendJob);
}

/** Bulk-enqueue send jobs; chunked so a 5000+ batch is a handful of inserts. */
export async function enqueueEmailSendBatch(emailIds: string[]): Promise<void> {
  const instance = await getBoss();
  const CHUNK = 500;
  for (let i = 0; i < emailIds.length; i += CHUNK) {
    await instance.insert(
      QUEUES.emailSend,
      emailIds.slice(i, i + CHUNK).map((emailId) => ({ data: { emailId } })),
    );
  }
}

export async function enqueueWebhookDispatch(jobs: WebhookDispatchJob[]): Promise<void> {
  if (jobs.length === 0) return;
  const instance = await getBoss();
  await instance.insert(
    QUEUES.webhookDispatch,
    jobs.map((job) => ({ data: job })),
  );
}

export type { PgBoss };
