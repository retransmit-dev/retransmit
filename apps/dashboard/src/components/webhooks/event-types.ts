/**
 * Mirrors WEBHOOK_EVENT_TYPES in @retransmit/db (kept local so the schema
 * package stays out of the client bundle). One endpoint can subscribe to any
 * mix of these; the same secret signs every channel's deliveries.
 */

export type WebhookChannel = "email" | "sms" | "whatsapp";

export const WEBHOOK_CHANNELS: { id: WebhookChannel; label: string }[] = [
  { id: "email", label: "Email" },
  { id: "sms", label: "SMS" },
  { id: "whatsapp", label: "WhatsApp" },
];

export const WEBHOOK_EVENT_OPTIONS = [
  { value: "email.sent", label: "Sent", description: "Handed to the upstream provider." },
  { value: "email.delivered", label: "Delivered", description: "The recipient's mail server accepted it." },
  { value: "email.delivery_delayed", label: "Delivery delayed", description: "Delivery was temporarily deferred." },
  { value: "email.opened", label: "Opened", description: "The recipient opened the email." },
  { value: "email.clicked", label: "Clicked", description: "The recipient clicked a link." },
  { value: "email.bounced", label: "Bounced", description: "The recipient's server permanently rejected it." },
  { value: "email.complained", label: "Complained", description: "The recipient marked it as spam." },
  { value: "email.rejected", label: "Rejected", description: "Rejected before sending." },
  { value: "email.failed", label: "Failed", description: "The provider send failed." },
  { value: "email.unsubscribed", label: "Unsubscribed", description: "The recipient unsubscribed from a marketing email." },
  { value: "sms.sent", label: "Sent", description: "Handed to the upstream provider." },
  { value: "sms.delivered", label: "Delivered", description: "The carrier reported successful delivery." },
  { value: "sms.undelivered", label: "Undelivered", description: "The carrier reported it undelivered, expired, or rejected." },
  { value: "sms.failed", label: "Failed", description: "The send failed after retries, or no route was available." },
  { value: "whatsapp.sent", label: "Sent", description: "WhatsApp accepted the message." },
  { value: "whatsapp.delivered", label: "Delivered", description: "The message reached the recipient's device." },
  { value: "whatsapp.read", label: "Read", description: "The recipient opened the message." },
  { value: "whatsapp.failed", label: "Failed", description: "The send failed after retries, or WhatsApp could not deliver it." },
  { value: "whatsapp.received", label: "Received", description: "A recipient sent you a message." },
] as const;

export type WebhookEventValue = (typeof WEBHOOK_EVENT_OPTIONS)[number]["value"];

export const ALL_WEBHOOK_EVENTS: WebhookEventValue[] = WEBHOOK_EVENT_OPTIONS.map(
  (option) => option.value,
);

export function eventChannel(value: string): WebhookChannel {
  return value.split(".")[0] as WebhookChannel;
}

export function eventsForChannel(channel: WebhookChannel) {
  return WEBHOOK_EVENT_OPTIONS.filter((option) => eventChannel(option.value) === channel);
}

/** How many of a channel's events a subscription covers, for the table badges. */
export function channelCounts(values: readonly string[]) {
  return WEBHOOK_CHANNELS.map((channel) => ({
    ...channel,
    selected: values.filter((value) => eventChannel(value) === channel.id).length,
    total: eventsForChannel(channel.id).length,
  })).filter((channel) => channel.selected > 0);
}

/** "email.delivered" reads as "Email delivered" in delivery rows. */
export function eventLabel(value: string): string {
  const option = WEBHOOK_EVENT_OPTIONS.find((candidate) => candidate.value === value);
  const channel = WEBHOOK_CHANNELS.find((candidate) => candidate.id === eventChannel(value));
  if (!option || !channel) return value;
  return `${channel.label} ${option.label.toLowerCase()}`;
}
