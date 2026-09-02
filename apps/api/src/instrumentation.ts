/**
 * Next.js instrumentation hook — runs once when the API server boots.
 * Starts the pg-boss workers (throttled SES sender, webhook dispatcher,
 * dead-letter handlers) inside this same long-running process, so the API
 * deployment doubles as the queue consumer.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startEmailWorkers } = await import("@retransmit/email/worker");
    await startEmailWorkers();
    const { startSmsWorkers } = await import("@retransmit/sms/worker");
    await startSmsWorkers();
  }
}
