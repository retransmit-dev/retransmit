import { protectedProcedure, publicProcedure, router } from "../index";
import { adminRouter } from "./admin";
import { analyticsRouter } from "./analytics";
import { apiKeyRouter } from "./api-keys";
import { domainRouter } from "./domains";
import { emailRouter } from "./emails";
import { organizationRouter } from "./organizations";
import { smsRouter } from "./sms";
import { smsSenderRouter } from "./sms-senders";
import { suppressionRouter } from "./suppressions";
import { todoRouter } from "./todo";
import { webhookRouter } from "./webhooks";
import { whatsappAccountRouter } from "./whatsapp-accounts";
import { whatsappTemplateRouter } from "./whatsapp-templates";

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
  admin: adminRouter,
  analytics: analyticsRouter,
  apiKey: apiKeyRouter,
  domain: domainRouter,
  email: emailRouter,
  organization: organizationRouter,
  sms: smsRouter,
  smsSender: smsSenderRouter,
  suppression: suppressionRouter,
  webhook: webhookRouter,
  whatsappAccount: whatsappAccountRouter,
  whatsappTemplate: whatsappTemplateRouter,
  todo: todoRouter,
});
export type AppRouter = typeof appRouter;
