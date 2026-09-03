import type { AppRouter } from "@retransmit/api/routers/index";
import type { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import { createQueryClient } from "@/trpc/query-client";

/**
 * tRPC for client components. The server-side counterpart, which prefetches
 * into the same cache shape, lives in `trpc/server.tsx`.
 *
 * The browser keeps one query client for the life of the tab. Server renders
 * of client components get a fresh one per call so nothing leaks between
 * requests; whatever they fetch is discarded with the render.
 */

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") return createQueryClient();
  return (browserQueryClient ??= createQueryClient());
}

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient: getQueryClient,
});
