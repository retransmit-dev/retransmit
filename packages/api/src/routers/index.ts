import { protectedProcedure, publicProcedure, router } from "../index";
import { analyticsRouter } from "./analytics";
import { apiKeyRouter } from "./api-keys";
import { domainRouter } from "./domains";
import { emailRouter } from "./emails";
import { organizationRouter } from "./organizations";
import { suppressionRouter } from "./suppressions";
import { todoRouter } from "./todo";
import { webhookRouter } from "./webhooks";
import { whatsappAccountRouter } from "./whatsapp-accounts";

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
  analytics: analyticsRouter,
  apiKey: apiKeyRouter,
  domain: domainRouter,
  email: emailRouter,
  organization: organizationRouter,
  suppression: suppressionRouter,
  webhook: webhookRouter,
  whatsappAccount: whatsappAccountRouter,
  todo: todoRouter,
});
export type AppRouter = typeof appRouter;
