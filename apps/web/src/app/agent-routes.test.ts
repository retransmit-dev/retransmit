import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET as getMarkdown } from "@/app/md/[[...slug]]/route";
import { GET as getOpenapi } from "@/app/openapi.json/route";
import { OPENAPI_DOCUMENT } from "@/lib/openapi";
import { proxy } from "@/proxy";

import { GET as apiGet, POST as apiPost } from "./api/[[...path]]/route";

function markdownRequest(slug?: string[]) {
  return getMarkdown(new Request("https://retransmit.dev/md"), {
    params: Promise.resolve({ slug }),
  });
}

describe("GET /md (markdown variants)", () => {
  it("serves the homepage as markdown with Vary: Accept", async () => {
    const response = await markdownRequest();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(response.headers.get("vary")).toBe("Accept");
    expect(await response.text()).toContain("# Retransmit");
  });

  it("serves compare pages as markdown", async () => {
    const response = await markdownRequest(["compare", "retransmit-vs-resend"]);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("# Retransmit vs Resend");
  });

  it("returns a markdown 404 with recovery links for unknown paths", async () => {
    const response = await markdownRequest(["no", "such", "page"]);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8",
    );
    const body = await response.text();
    expect(body).toContain("404");
    expect(body).toContain("/sitemap.xml");
    expect(body).toContain("/llms.txt");
  });
});

describe("GET /openapi.json", () => {
  it("serves the spec as JSON", async () => {
    const response = getOpenapi();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = await response.json();
    expect(body).toEqual(JSON.parse(JSON.stringify(OPENAPI_DOCUMENT)));
  });
});

describe("/api catch-all", () => {
  it("returns a structured JSON 404 for any method", async () => {
    for (const handler of [apiGet, apiPost]) {
      const response = handler();
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      const body = await response.json();
      expect(body.error.code).toBe("not_found");
      expect(body.error.message).toContain("api.retransmit.dev");
      expect(body.error.hint).toContain("openapi.json");
    }
  });
});

describe("proxy content negotiation", () => {
  function run(path: string, headers: Record<string, string> = {}) {
    return proxy(
      new NextRequest(`https://retransmit.dev${path}`, { headers }),
    );
  }

  it("rewrites Accept: text/markdown to the markdown handler", () => {
    const response = run("/compare", { accept: "text/markdown" });
    const rewrite = response.headers.get("x-middleware-rewrite");
    expect(rewrite).toContain("/md/compare");
    expect(response.headers.get("vary")).toContain("Accept");
  });

  it("rewrites the homepage to /md", () => {
    const response = run("/", { accept: "text/markdown, text/html, */*" });
    expect(response.headers.get("x-middleware-rewrite")).toContain("/md");
  });

  it("passes browsers through with Vary: Accept", () => {
    const response = run("/compare", {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    });
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("vary")).toContain("Accept");
  });

  it("serves .md sibling URLs", () => {
    const response = run("/compare/retransmit-vs-resend.md");
    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/md/compare/retransmit-vs-resend",
    );
  });

  it("maps /index.md to the homepage markdown", () => {
    const response = run("/index.md");
    const rewrite = new URL(response.headers.get("x-middleware-rewrite")!);
    expect(rewrite.pathname).toBe("/md");
  });

  it("returns 406 with the available representations listed", async () => {
    const response = run("/compare", { accept: "application/pdf" });
    expect(response.status).toBe(406);
    expect(response.headers.get("vary")).toContain("Accept");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.text();
    expect(body).toContain("text/html");
    expect(body).toContain("text/markdown");
    expect(body).toContain("application/pdf");
  });

  it("does not negotiate RSC navigation fetches", () => {
    const response = run("/compare", {
      accept: "text/markdown",
      rsc: "1",
    });
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("does not negotiate non-GET requests", () => {
    const response = proxy(
      new NextRequest("https://retransmit.dev/compare", {
        method: "POST",
        headers: { accept: "text/markdown" },
      }),
    );
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
});
