import type { AppRouter } from "@retransmit/api/routers/index";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

/** Output types of the API, for components that receive query data as props. */
export type RouterOutputs = inferRouterOutputs<AppRouter>;

/** Input types of the API, for form state that has to match a procedure. */
export type RouterInputs = inferRouterInputs<AppRouter>;
