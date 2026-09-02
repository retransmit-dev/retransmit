import { protectedProcedure, publicProcedure, router } from "../index";
import { apiKeyRouter } from "./api-keys";
import { domainRouter } from "./domains";
import { emailRouter } from "./emails";
import { todoRouter } from "./todo";
import { webhookRouter } from "./webhooks";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  apiKey: apiKeyRouter,
  domain: domainRouter,
  email: emailRouter,
  webhook: webhookRouter,
  todo: todoRouter,
});
export type AppRouter = typeof appRouter;
