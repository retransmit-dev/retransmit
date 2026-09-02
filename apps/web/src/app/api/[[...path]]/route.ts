import { siteConfig } from "@/lib/site";

/* retransmit.dev is the marketing site; the REST API lives at
   api.retransmit.dev. Anything probing /api here gets a structured JSON
   error pointing at the real surface instead of an HTML page. */

function apiNotFound() {
  return Response.json(
    {
      error: {
        code: "not_found",
        message:
          "retransmit.dev does not serve an API. The Retransmit REST API is at https://api.retransmit.dev.",
        hint: `The API surface is described at ${siteConfig.url}/openapi.json; documentation is at ${siteConfig.links.docs}.`,
      },
    },
    {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export const GET = apiNotFound;
export const POST = apiNotFound;
export const PUT = apiNotFound;
export const PATCH = apiNotFound;
export const DELETE = apiNotFound;
