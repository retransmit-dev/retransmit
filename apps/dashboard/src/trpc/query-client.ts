import {
  defaultShouldDehydrateQuery,
  MutationCache,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * One factory for every query client: the per-request one on the server (see
 * `trpc/server.tsx`) and the browser singleton (see `utils/trpc.ts`).
 *
 * Errors are handled in two places on purpose. A query that has nothing to
 * show throws to the nearest `ErrorBoundary`, so a broken section shows its
 * own "Try again" instead of an empty table, and the rest of the page keeps
 * working. A query that already has data (a background refetch or a poll)
 * keeps showing it and surfaces the failure as a toast. Mutations always
 * toast, so no call site needs its own `onError`.
 */
export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (typeof window === "undefined") return;
        if (query.state.data === undefined) return;
        toast.error(error.message, {
          action: {
            label: "Retry",
            onClick: () => {
              query.invalidate();
            },
          },
        });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        if (typeof window === "undefined") return;
        toast.error(error.message);
      },
    }),
    defaultOptions: {
      queries: {
        // Data prefetched on the server is fresh when the page mounts; without
        // a stale window the browser would refetch it straight away.
        staleTime: 30 * 1000,
        throwOnError: (_error, query) => query.state.data === undefined,
      },
      dehydrate: {
        // Include in-flight queries so a `prefetch` that has not resolved by
        // the time the page renders streams its result to the browser.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  });
}
