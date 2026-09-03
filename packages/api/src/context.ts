import { auth } from "@retransmit/auth";
import type { NextRequest } from "next/server";

/**
 * Builds the request context from a set of headers. Shared by the HTTP route
 * handler and by server components that call the router directly to prefetch
 * data before the page streams to the browser.
 */
export async function createContextFromHeaders(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  return {
    auth: null,
    session,
  };
}

export function createContext(req: NextRequest) {
  return createContextFromHeaders(req.headers);
}

export type Context = Awaited<ReturnType<typeof createContext>>;
