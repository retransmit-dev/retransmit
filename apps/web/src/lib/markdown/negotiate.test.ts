import { describe, expect, it } from "vitest";

import { negotiate } from "./negotiate";

describe("negotiate", () => {
  /* Test vectors from acceptmarkdown.com/guides/accept-parsing. */
  it("serves markdown for a bare text/markdown", () => {
    expect(negotiate("text/markdown")).toBe("markdown");
  });

  it("serves markdown when it outranks html by q", () => {
    expect(negotiate("text/markdown, text/html;q=0.8")).toBe("markdown");
  });

  it("serves html for a bare text/html", () => {
    expect(negotiate("text/html")).toBe("html");
  });

  it("respects q=0 as explicit rejection of markdown", () => {
    expect(negotiate("text/markdown;q=0, text/html")).toBe("html");
  });

  it("returns 406 when markdown is rejected and nothing else matches", () => {
    expect(negotiate("text/markdown;q=0")).toBe("not-acceptable");
  });

  it("serves the default for a missing Accept header", () => {
    expect(negotiate(null)).toBe("html");
    expect(negotiate(undefined)).toBe("html");
    expect(negotiate("")).toBe("html");
  });

  it("serves the default for */*", () => {
    expect(negotiate("*/*")).toBe("html");
  });

  /* Real client headers, from acceptmarkdown.com/status. */
  it("serves markdown to Claude Code (markdown and html tied at q=1)", () => {
    expect(negotiate("text/markdown, text/html, */*")).toBe("markdown");
  });

  it("serves markdown to Cursor", () => {
    expect(negotiate("text/markdown, text/plain;q=0.9, */*;q=0.8")).toBe(
      "markdown",
    );
  });

  it("serves markdown to OpenCode", () => {
    expect(
      negotiate(
        "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1",
      ),
    ).toBe("markdown");
  });

  it("serves html to Chrome", () => {
    expect(
      negotiate(
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      ),
    ).toBe("html");
  });

  it("returns 406 for a type we cannot produce", () => {
    expect(negotiate("application/pdf")).toBe("not-acceptable");
  });

  it("uses the most specific match, not the highest q", () => {
    /* text/* would allow markdown at 0.9, but the exact entry pins html
       to 1 and markdown has no exact entry, so html wins on q. */
    expect(negotiate("text/html;q=1, text/*;q=0.9")).toBe("html");
    /* Exact rejection beats a wildcard grant. */
    expect(negotiate("text/*;q=0.5, text/markdown;q=0")).toBe("html");
  });

  it("does not serve markdown on a subtype wildcard alone", () => {
    /* text/* matches both equally; the client never named markdown. */
    expect(negotiate("text/*")).toBe("html");
  });

  it("ignores case and whitespace", () => {
    expect(negotiate("  TEXT/MARKDOWN ; Q=0.9 , text/html;q=0.4")).toBe(
      "markdown",
    );
  });

  it("treats malformed entries as no constraint", () => {
    expect(negotiate("garbage")).toBe("html");
  });
});
