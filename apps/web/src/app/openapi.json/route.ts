import { OPENAPI_DOCUMENT } from "@/lib/openapi";

/* Publishes the OpenAPI spec at https://retransmit.dev/openapi.json so
   agents can discover the API surface from the marketing domain. */

export const dynamic = "force-static";

export function GET() {
  return Response.json(OPENAPI_DOCUMENT, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  });
}
