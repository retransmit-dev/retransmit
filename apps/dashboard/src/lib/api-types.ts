import type { AppRouter } from "@retransmit/api/routers/index";
import type { inferRouterOutputs } from "@trpc/server";

/** Output types of the API, for components that receive query data as props. */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
