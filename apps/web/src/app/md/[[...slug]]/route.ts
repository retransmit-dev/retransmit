import { markdownForPath, notFoundMarkdown } from "@/lib/markdown/render";

/* Serves the Markdown representation of a page. The proxy rewrites here
   for `Accept: text/markdown` requests and `.md` sibling URLs; the page
   path arrives as the catch-all segments. Unknown paths return a 404
   whose body tells agents where to look next. */

const BASE_HEADERS = {
  "Content-Type": "text/markdown; charset=utf-8",
  Vary: "Accept",
  /* The Markdown variant is for agents; the canonical HTML page is
     what search engines should index. */
  "X-Robots-Tag": "noindex",
} as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await context.params;
  const pathname = slug?.length ? `/${slug.join("/")}` : "/";

  const markdown = markdownForPath(pathname);
  if (markdown === null) {
    return new Response(notFoundMarkdown(pathname), {
      status: 404,
      headers: { ...BASE_HEADERS, "Cache-Control": "no-store" },
    });
  }

  return new Response(markdown, { status: 200, headers: BASE_HEADERS });
}
