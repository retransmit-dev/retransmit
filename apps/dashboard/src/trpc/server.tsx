import { createContextFromHeaders } from "@retransmit/api/context";
import { appRouter } from "@retransmit/api/routers/index";
import type { AppRouter } from "@retransmit/api/routers/index";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { TRPCQueryOptions } from "@trpc/tanstack-react-query";
import { headers } from "next/headers";
import { cache } from "react";
import type { ReactNode } from "react";

import { createQueryClient } from "./query-client";

/**
 * tRPC for server components.
 *
 * A page calls `prefetch` for the queries its client components will ask for,
 * then wraps them in `HydrateClient`. The calls go straight to the router (no
 * HTTP round trip), start before the page streams, and land in the browser's
 * query cache, so the first render already has data or an in-flight promise.
 * Client components keep using `useQuery` with the same options and notice
 * nothing.
 *
 * Both the context and the query client are request scoped via `cache`, so
 * one request never sees another's session or data.
 */

const createContext = cache(async () => {
  const requestHeaders = new Headers(await headers());
  requestHeaders.set("x-trpc-source", "rsc");
  return createContextFromHeaders(requestHeaders);
});

export const getQueryClient = cache(createQueryClient);

export const trpc = createTRPCOptionsProxy<AppRouter>({
  router: appRouter,
  ctx: createContext,
  queryClient: getQueryClient,
});

export function HydrateClient({ children }: { children: ReactNode }) {
  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      {children}
    </HydrationBoundary>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQueryOptions = ReturnType<TRPCQueryOptions<any>>;

const noop = () => {};

/**
 * Starts a query on the server without awaiting it. A failure here is not
 * the page's problem: the query is left out of the dehydrated state and the
 * browser fetches it again, where the section's `ErrorBoundary` handles it.
 */
export function prefetch<T extends AnyQueryOptions>(queryOptions: T) {
  const queryClient = getQueryClient();
  if (queryOptions.queryKey[1]?.type === "infinite") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryClient.infiniteQuery(queryOptions as any).catch(noop);
  } else {
    queryClient.query(queryOptions).catch(noop);
  }
}

export function batchPrefetch<T extends AnyQueryOptions>(queryOptions: T[]) {
  for (const options of queryOptions) prefetch(options);
}
