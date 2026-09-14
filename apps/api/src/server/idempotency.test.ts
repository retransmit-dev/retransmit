import { describe, expect, it } from "vitest";

import { hashRequest, stableStringify } from "./idempotency";

describe("stableStringify", () => {
  it("is insensitive to key order, so the same body always hashes alike", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it("drops undefined values, which JSON would have omitted anyway", () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }));
  });

  it("serialises a Date by its instant, not as an empty object", () => {
    // A Date has no own enumerable properties, so the object branch would
    // render every date as `{}`.
    expect(stableStringify(new Date("2026-09-20T09:00:00Z"))).toBe('"2026-09-20T09:00:00.000Z"');
  });

  it("tells two different dates apart", () => {
    const first = { scheduled_at: new Date("2026-09-20T09:00:00Z") };
    const second = { scheduled_at: new Date("2026-09-21T09:00:00Z") };

    expect(stableStringify(first)).not.toBe(stableStringify(second));
  });

  it("recurses into arrays and nested objects", () => {
    expect(stableStringify({ tags: [{ value: "b", name: "a" }] })).toBe(
      '{"tags":[{"name":"a","value":"b"}]}',
    );
  });
});

describe("hashRequest", () => {
  it("gives the same hash for the same endpoint and body", () => {
    const body = { to: "a@example.com", scheduled_at: new Date("2026-09-20T09:00:00Z") };

    expect(hashRequest("POST /v1/emails", body)).toBe(hashRequest("POST /v1/emails", { ...body }));
  });

  it("changes when the scheduled time changes", () => {
    // Otherwise a retry with the same Idempotency-Key but a different
    // `scheduled_at` would replay the first response instead of being
    // rejected as a different payload.
    const first = hashRequest("POST /v1/emails", {
      scheduled_at: new Date("2026-09-20T09:00:00Z"),
    });
    const second = hashRequest("POST /v1/emails", {
      scheduled_at: new Date("2026-09-21T09:00:00Z"),
    });

    expect(first).not.toBe(second);
  });

  it("changes when the endpoint changes", () => {
    expect(hashRequest("POST /v1/emails", { a: 1 })).not.toBe(
      hashRequest("POST /v1/emails/batch", { a: 1 }),
    );
  });
});
