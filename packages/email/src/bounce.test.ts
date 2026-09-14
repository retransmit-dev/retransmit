import { describe, expect, it } from "vitest";

import { classifyBounce } from "./bounce";
import type { SesBounce } from "./bounce";

/** Builds the shape SES puts on the wire for one bounced recipient. */
function bounce(
  bounceType: string,
  diagnosticCode?: string,
  extra: Partial<SesBounce> = {},
): SesBounce {
  return {
    bounceType,
    bouncedRecipients: diagnosticCode
      ? [{ emailAddress: "someone@example.com", action: "failed", diagnosticCode }]
      : [{ emailAddress: "someone@example.com", action: "failed" }],
    ...extra,
  };
}

describe("classifyBounce", () => {
  describe("Microsoft 365 / Exchange Online", () => {
    it("reads a content-filter rejection as a spam block, and does not suppress", () => {
      const result = classifyBounce(
        bounce(
          "Permanent",
          "smtp; 550 5.7.1 Message rejected as spam by Content Filtering. [Hostname=AM0PR04MB.eurprd04.prod.outlook.com] S3140",
        ),
      );
      expect(result.reason).toBe("spam_block");
      expect(result.suppress).toBe(false);
    });

    it("reads a banned sending IP as a reputation block", () => {
      const result = classifyBounce(
        bounce(
          "Permanent",
          "smtp; 550 5.7.606 Access denied, banned sending IP [1.2.3.4]. To request removal from this list please visit https://sender.office.com/",
        ),
      );
      expect(result.reason).toBe("reputation_block");
      expect(result.suppress).toBe(false);
    });

    it("reads a DMARC rejection as an authentication failure", () => {
      const result = classifyBounce(
        bounce(
          "Permanent",
          "smtp; 550 5.7.509 Access denied, sending domain [acme.com] does not pass DMARC verification",
        ),
      );
      expect(result.reason).toBe("authentication_failure");
      expect(result.suppress).toBe(false);
    });

    it("reads RESOLVER.ADR.RecipientNotFound as a dead mailbox, and suppresses", () => {
      const result = classifyBounce(
        bounce(
          "Permanent",
          "smtp; 550 5.1.10 RESOLVER.ADR.RecipientNotFound; Recipient not found by SMTP address lookup",
        ),
      );
      expect(result.reason).toBe("mailbox_not_found");
      expect(result.suppress).toBe(true);
    });

    it("reads a 4.7.5xx server-busy rejection as throttling", () => {
      const result = classifyBounce(
        bounce("Transient", "smtp; 451 4.7.500 Server busy, please try again later"),
      );
      expect(result.reason).toBe("rate_limited");
      expect(result.suppress).toBe(false);
    });
  });

  describe("Google", () => {
    it("reads the unsolicited-mail rejection as a spam block", () => {
      const result = classifyBounce(
        bounce(
          "Permanent",
          "smtp; 550-5.7.1 [1.2.3.4] Our system has detected that this message is likely unsolicited mail. To reduce the amount of spam sent to Gmail, this message has been blocked.",
        ),
      );
      expect(result.reason).toBe("spam_block");
      expect(result.suppress).toBe(false);
    });

    it("reads 5.7.26 as an authentication failure", () => {
      const result = classifyBounce(
        bounce(
          "Permanent",
          "smtp; 550-5.7.26 This mail has been blocked because the sender is unauthenticated.",
        ),
      );
      expect(result.reason).toBe("authentication_failure");
    });

    it("reads a missing account as a dead mailbox", () => {
      const result = classifyBounce(
        bounce(
          "Permanent",
          "smtp; 550 5.1.1 The email account that you tried to reach does not exist.",
        ),
      );
      expect(result.reason).toBe("mailbox_not_found");
      expect(result.suppress).toBe(true);
    });
  });

  describe("generic servers", () => {
    it("reads a blocklist rejection as a reputation block", () => {
      const result = classifyBounce(
        bounce("Permanent", "smtp; 554 5.7.1 Service unavailable; Client host [1.2.3.4] blocked using Spamhaus"),
      );
      expect(result.reason).toBe("reputation_block");
      expect(result.suppress).toBe(false);
    });

    it("reads a full mailbox as transient and does not suppress", () => {
      const result = classifyBounce(
        bounce("Transient", "smtp; 452 4.2.2 The email account that you tried to reach is over quota"),
      );
      expect(result.reason).toBe("mailbox_full");
      expect(result.suppress).toBe(false);
    });

    it("reads an unresolvable domain as a DNS failure, and suppresses", () => {
      const result = classifyBounce(
        bounce("Permanent", "smtp; 550 5.4.4 Host or domain name not found"),
      );
      expect(result.reason).toBe("dns_failure");
      expect(result.suppress).toBe(true);
    });

    it("does not read a missing domain as a missing mailbox", () => {
      const result = classifyBounce(
        bounce("Permanent", "smtp; 550 5.1.2 The domain you sent to does not exist"),
      );
      expect(result.reason).toBe("dns_failure");
    });
  });

  describe("fallbacks", () => {
    it("falls back to the SES bounce subtype when there is no diagnostic code", () => {
      const result = classifyBounce(bounce("Permanent", undefined, { bounceSubType: "MailboxFull" }));
      expect(result.reason).toBe("mailbox_full");
    });

    it("treats an unreadable permanent bounce as unknown, and still suppresses", () => {
      const result = classifyBounce(bounce("Permanent", "smtp; 550 rejected"));
      expect(result.reason).toBe("unknown");
      expect(result.suppress).toBe(true);
    });

    it("never suppresses a transient bounce, whatever the wording", () => {
      const result = classifyBounce(
        bounce("Transient", "smtp; 450 4.1.1 recipient not found, try again"),
      );
      expect(result.reason).toBe("mailbox_not_found");
      expect(result.suppress).toBe(false);
    });

    it("handles a missing bounce object", () => {
      const result = classifyBounce(undefined);
      expect(result.reason).toBe("unknown");
      expect(result.suppress).toBe(false);
    });

    it("puts the diagnostic code in the message and keeps it short", () => {
      const result = classifyBounce(bounce("Permanent", `smtp; 550 5.1.1 ${"x".repeat(500)}`));
      expect(result.message).toContain("does not exist");
      expect(result.message.length).toBeLessThan(320);
    });
  });
});
