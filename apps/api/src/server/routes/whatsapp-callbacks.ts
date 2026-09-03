import { processMetaWebhook, verifyMetaSignature } from "@retransmit/whatsapp/delivery";
import { Hono } from "hono";

export const whatsappCallbackRoutes = new Hono();

/**
 * Meta webhook verification handshake. When the callback URL is registered
 * (App Dashboard → WhatsApp → Configuration, or infra/setup-whatsapp.sh)
 * Meta GETs it with `hub.mode=subscribe`, `hub.verify_token` and
 * `hub.challenge`; we must echo the challenge when the token matches
 * WHATSAPP_META_VERIFY_TOKEN.
 */
whatsappCallbackRoutes.get("/meta", (c) => {
  const expected = process.env.WHATSAPP_META_VERIFY_TOKEN;
  const challenge = c.req.query("hub.challenge");
  if (
    c.req.query("hub.mode") === "subscribe" &&
    expected &&
    c.req.query("hub.verify_token") === expected &&
    challenge
  ) {
    return c.text(challenge);
  }
  return c.json({ error: { code: "unauthorized", message: "Invalid verify token" } }, 403);
});

/**
 * Meta notifications for the `messages` field: delivery statuses for our
 * outbound messages and inbound messages from customers. The signature is
 * checked over the raw body with the app secret. Meta expects a fast 200 and
 * redelivers (then disables the subscription) on anything else, so
 * processing errors are logged instead of surfaced.
 */
whatsappCallbackRoutes.post("/meta", async (c) => {
  const raw = await c.req.text();
  if (!verifyMetaSignature(raw, c.req.header("x-hub-signature-256"))) {
    return c.json({ error: { code: "unauthorized", message: "Invalid signature" } }, 401);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return c.json({ error: { code: "invalid_json", message: "Body must be valid JSON" } }, 400);
  }

  try {
    const { applied } = await processMetaWebhook(json);
    return c.json({ ok: true, applied });
  } catch (cause) {
    console.error("[whatsapp] failed to process Meta webhook", cause);
    return c.json({ ok: false });
  }
});
