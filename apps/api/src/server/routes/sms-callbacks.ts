import { processMtnDeliveryReceipt, processOrangeDeliveryReceipt } from "@retransmit/sms/delivery";
import { Hono } from "hono";
import type { Context } from "hono";

export const smsCallbackRoutes = new Hono();

/**
 * Carriers do not sign their delivery callbacks, so each registration carries
 * a shared secret, SMS_CALLBACK_TOKEN, presented either way:
 * - as a query string, `https://api.../v1/callbacks/sms/<provider>?token=<value>`
 *   (MTN's deliveryReportUrl), or
 * - as HTTP Basic auth with username SMS_CALLBACK_USER (default "retransmit")
 *   and the token as password (Orange's "Basic authentication" option).
 * Requests are matched to messages by ids we issued or stored ourselves, so a
 * forged call without the secret can at worst do nothing.
 */
function isAuthorized(c: Context): boolean {
  const expected = process.env.SMS_CALLBACK_TOKEN;
  if (!expected) return true;
  if (c.req.query("token") === expected) return true;

  const header = c.req.header("authorization") ?? "";
  if (!/^Basic\s+/i.test(header)) return false;
  const decoded = Buffer.from(header.replace(/^Basic\s+/i, ""), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 0) return false;
  const user = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);
  return user === (process.env.SMS_CALLBACK_USER ?? "retransmit") && password === expected;
}

async function handleReceipt(
  c: Context,
  processReceipt: (payload: unknown) => Promise<{ applied: boolean }>,
) {
  if (!isAuthorized(c)) {
    return c.json({ error: { code: "unauthorized", message: "Invalid callback credentials" } }, 401);
  }

  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    return c.json({ error: { code: "invalid_json", message: "Body must be valid JSON" } }, 400);
  }

  const { applied } = await processReceipt(json);
  return c.json({ ok: true, applied });
}

/**
 * MTN delivery receipts (DeliveryNotificationRequest). Registered through
 * MTN's subscription endpoint as the `deliveryReportUrl`.
 */
smsCallbackRoutes.post("/mtn", (c) => handleReceipt(c, processMtnDeliveryReceipt));

/**
 * Orange delivery receipts (deliveryInfoNotification). Pasted into
 * "Configure Callback" in the Orange developer portal; Orange requires HTTPS
 * on port 443 with a CA-signed certificate and a 200 response.
 */
smsCallbackRoutes.post("/orange", (c) => handleReceipt(c, processOrangeDeliveryReceipt));
