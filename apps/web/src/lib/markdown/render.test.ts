import { describe, expect, it } from "vitest";

import { publishedPages } from "@/lib/pages";
import { siteConfig } from "@/lib/site";

import {
  hasMarkdown,
  homeMarkdown,
  markdownForPath,
  notFoundMarkdown,
} from "./render";

describe("markdownForPath", () => {
  it("covers the homepage and every published page", () => {
    expect(hasMarkdown("/")).toBe(true);
    for (const page of publishedPages()) {
      expect(hasMarkdown(page.href), page.href).toBe(true);
    }
  });

  it("returns null for unknown paths", () => {
    expect(markdownForPath("/nope")).toBeNull();
    expect(markdownForPath("/compare/nope")).toBeNull();
  });

  it("renders a heading, no template holes, and the agent footer", () => {
    for (const page of publishedPages()) {
      const markdown = markdownForPath(page.href);
      expect(markdown).toBeTruthy();
      expect(markdown).toMatch(/^# /);
      expect(markdown).not.toContain("undefined");
      expect(markdown).not.toContain("[object Object]");
      expect(markdown).toContain(`Canonical: ${siteConfig.url}${page.href}`);
      expect(markdown).toContain("/llms.txt");
      expect(markdown).toContain("/openapi.json");
      expect(markdown).toContain("/sitemap.xml");
    }
  });

  it("renders comparison tables as GFM tables", () => {
    const markdown = markdownForPath("/compare/retransmit-vs-resend");
    expect(markdown).toContain("| --- |");
    expect(markdown).toContain("| Positioning |");
    /* Linked cells become markdown links. */
    expect(markdown).toContain("](https://resend.com/pricing)");
  });

  it("renders FAQ entries as headings with answers", () => {
    const markdown = markdownForPath("/compare/retransmit-vs-resend");
    expect(markdown).toContain("## Questions people ask");
    expect(markdown).toMatch(/### .+\?/);
  });

  it("lists every published compare page on the compare hub", () => {
    const markdown = markdownForPath("/compare");
    for (const page of publishedPages()) {
      if (page.group !== "compare" || page.href === "/compare") continue;
      expect(markdown).toContain(`${siteConfig.url}${page.href}`);
    }
  });
});

describe("homeMarkdown", () => {
  it("carries the product identity and entry points", () => {
    const markdown = homeMarkdown();
    expect(markdown).toContain("# Retransmit");
    expect(markdown).toContain(siteConfig.links.quickstart);
    expect(markdown).toContain(siteConfig.links.docs);
    expect(markdown).toContain(siteConfig.links.github);
  });
});

describe("notFoundMarkdown", () => {
  it("gives agents the path, a site map, and machine-readable pointers", () => {
    const markdown = notFoundMarkdown("/some/missing/page");
    expect(markdown).toContain("404");
    expect(markdown).toContain("`/some/missing/page`");
    expect(markdown).toContain(`${siteConfig.url}/sitemap.xml`);
    expect(markdown).toContain(`${siteConfig.url}/llms.txt`);
    expect(markdown).toContain(`${siteConfig.url}/openapi.json`);
    expect(markdown).toContain(siteConfig.links.docs);
    for (const page of publishedPages()) {
      expect(markdown).toContain(`${siteConfig.url}${page.href}`);
    }
  });
});
