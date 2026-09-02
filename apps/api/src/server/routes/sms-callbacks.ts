import { processMtnDeliveryReceipt } from "@retransmit/sms/delivery";
import { Hono } from "hono";

export const smsCallbackRoutes = new Hono();

/**
 * MTN delivery receipts (DeliveryNotificationRequest). MTN does not sign its
 * callbacks, so the URL registered with the subscription endpoint carries a
 * shared secret: set SMS_CALLBACK_TOKEN and register the deliveryReportUrl as
 * `https://api.../v1/callbacks/sms/mtn?token=<value>`. Requests are matched
 * to messages by our own clientCorrelatorId, so a forged call without the
 * token can at worst do nothing.
 */
smsCallbackRoutes.post("/mtn", async (c) => {
  const expected = process.env.SMS_CALLBACK_TOKEN;
  if (expected && c.req.query("token") !== expected) {
    return c.json({ error: { code: "unauthorized", message: "Invalid callback token" } }, 401);
  }

  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    return c.json({ error: { code: "invalid_json", message: "Body must be valid JSON" } }, 400);
  }

  const { applied } = await processMtnDeliveryReceipt(json);
  return c.json({ ok: true, applied });
});
