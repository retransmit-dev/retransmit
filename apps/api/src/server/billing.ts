import type { LimitCheck, LimitFailure } from "@retransmit/billing";

/**
 * Turns a refused limit check into the API's error shape. 402 rather than 403:
 * the request was allowed, the account just cannot pay for it, and that is the
 * distinction a client needs to decide between prompting for an upgrade and
 * reporting a permissions problem.
 */
export function limitErrorResponse(failure: LimitFailure) {
  return {
    status: 402 as const,
    body: {
      error: {
        code: failure.code,
        message: failure.message,
        limit: failure.limit,
        used: failure.used,
      },
    },
  };
}

/** Narrows a check to its failure, for `if (const error = ...)` style callers. */
export function limitFailure(check: LimitCheck): LimitFailure | null {
  return check.ok ? null : check;
}

/**
 * Emails are billed per recipient, which is what SES charges for: one message
 * to ten addresses is ten deliveries. `to`, `cc` and `bcc` all count.
 */
export function recipientCount(input: {
  to: string[];
  cc?: string[] | undefined;
  bcc?: string[] | undefined;
}): number {
  return input.to.length + (input.cc?.length ?? 0) + (input.bcc?.length ?? 0);
}
