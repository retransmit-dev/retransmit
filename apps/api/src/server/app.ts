import { Hono } from "hono";

import { callbackRoutes } from "./routes/callbacks";
import { emailRoutes } from "./routes/emails";
import { smsRoutes } from "./routes/sms";
import { smsCallbackRoutes } from "./routes/sms-callbacks";
import { unsubscribeRoutes } from "./routes/unsubscribe";

export const app = new Hono();

app.get("/", (c) =>
  c.json({
    service: "retransmit",
    docs: "https://docs.retransmit.dev",
  }),
);

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/v1/emails", emailRoutes);
app.route("/v1/sms", smsRoutes);
app.route("/v1/callbacks", callbackRoutes);
app.route("/v1/callbacks/sms", smsCallbackRoutes);
// Public, token-authenticated pages linked from marketing emails.
app.route("/unsubscribe", unsubscribeRoutes);

app.notFound((c) =>
  c.json({ error: { code: "not_found", message: "The requested resource does not exist" } }, 404),
);

app.onError((error, c) => {
  console.error("Unhandled API error", error);
  return c.json(
    { error: { code: "internal_error", message: "An unexpected error occurred" } },
    500,
  );
});
