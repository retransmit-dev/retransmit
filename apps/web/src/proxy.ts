import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { negotiate } from "@/lib/markdown/negotiate";

/* Markdown content negotiation (acceptmarkdown.com convention):
   - `Accept: text/markdown` on any page URL serves the Markdown variant.
   - `.md` sibling URLs (`/compare.md`, `/index.md`) serve it directly.
   - Every negotiated response carries `Vary: Accept` so CDNs cache the
     HTML and Markdown variants separately.
   - An Accept header that admits neither HTML nor Markdown gets a 406
     listing the available representations (RFC 9110 §15.5.7). */

function passThroughWithVary() {
  const response = NextResponse.next();
  response.headers.append("Vary", "Accept");
  return response;
}

function rewriteToMarkdown(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? "/md" : `/md${pathname}`;
  const response = NextResponse.rewrite(url);
  response.headers.append("Vary", "Accept");
  return response;
}

export function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }

  /* Client-side navigations fetch the RSC payload from page URLs; they
     are not part of the HTML/Markdown negotiation. */
  if (request.headers.has("rsc")) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  /* `.md` siblings, advertised via <link rel="alternate"> for agents
     that do not send an Accept preference. */
  if (pathname.endsWith(".md")) {
    const base = pathname === "/index.md" ? "/" : pathname.slice(0, -3);
    return rewriteToMarkdown(request, base);
  }

  const decision = negotiate(request.headers.get("accept"));

  if (decision === "markdown") {
    return rewriteToMarkdown(request, pathname);
  }

  if (decision === "not-acceptable") {
    const accept = request.headers.get("accept") ?? "";
    return new NextResponse(
      [
        "This resource is available as:",
        "- text/html",
        "- text/markdown",
        "",
        `You requested: ${accept}`,
        "",
      ].join("\n"),
      {
        status: 406,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          Vary: "Accept",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return passThroughWithVary();
}

export const config = {
  /* Page routes only. Static agent files, the JSON API surface, and the
     internal /md handler negotiate nothing and keep their own headers. */
  matcher: [
    "/((?!_next/|api/|md/|md$|favicon\\.ico|sitemap\\.xml|robots\\.txt|llms\\.txt|openapi\\.json|opengraph-image|twitter-image).*)",
  ],
};
