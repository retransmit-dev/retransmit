import type { Route } from "next";

export type Product = {
  slug: string;
  name: string;
  status: "available" | "coming-soon";
  summary: string;
  headline: string;
  description: string;
  useCases: readonly string[];
  features: readonly { title: string; description: string }[];
  example?: {
    method: string;
    fields: readonly { name: string; value: string }[];
    note?: string;
    previewTitle: string;
    previewBody: string;
  };
};

// Add a product here to include it in navigation, pages, the sitemap and Markdown.
export const PRODUCTS: readonly Product[] = [
  {
    slug: "email",
    name: "Email",
    status: "available",
    summary: "Receipts, welcome emails, and account updates.",
    headline: "Transactional email from your domain.",
    description:
      "Welcome emails, receipts, and account updates. Send from your own domain and follow every delivery.",
    useCases: ["Welcome emails", "Order receipts", "Account updates"],
    features: [
      {
        title: "Your domain. Your name.",
        description:
          "Verify your domain with SPF and DKIM. We give you the DNS records to copy.",
      },
      {
        title: "One email or 10,000.",
        description:
          "Queue a whole batch in one request, with a separate ID and event history for each email.",
      },
      {
        title: "Know where it landed.",
        description:
          "Track deliveries, opens, and bounces. Signed webhooks bring the updates to your app.",
      },
    ],
    example: {
      method: "emails.send",
      fields: [
        { name: "from", value: "Acme <hello@acme.com>" },
        { name: "to", value: "jane@example.com" },
        { name: "subject", value: "You're in. Welcome to Acme." },
        { name: "html", value: "<p>Make yourself at home.</p>" },
      ],
      previewTitle: "You're in. Welcome to Acme.",
      previewBody: "Make yourself at home.",
    },
  },
  {
    slug: "sms",
    name: "SMS",
    status: "available",
    summary: "Verification codes and time-sensitive alerts.",
    headline: "SMS from the same API.",
    description:
      "Send verification codes, delivery updates, and reminders. One request, with routing handled for you.",
    useCases: [
      "Verification codes",
      "Delivery updates",
      "Appointment reminders",
    ],
    features: [
      {
        title: "The route is handled.",
        description:
          "The destination number determines the country. Retransmit picks the lowest-cost configured provider.",
      },
      {
        title: "A familiar sender.",
        description:
          "Use your own sender ID where supported, or the default sender for the route.",
      },
      {
        title: "Follow every text.",
        description:
          "Receive delivery receipts through signed webhooks and look up a message's event history.",
      },
    ],
    example: {
      method: "sms.send",
      fields: [
        { name: "from", value: "Acme" },
        { name: "to", value: "+237670000000" },
        { name: "text", value: "Your order is on its way. See you soon!" },
      ],
      previewTitle: "Acme",
      previewBody: "Your order is on its way. See you soon!",
    },
  },
  {
    slug: "whatsapp",
    name: "WhatsApp",
    status: "available",
    summary: "Templates, media, and customer replies.",
    headline: "Send and receive WhatsApp messages.",
    description:
      "Connect your WhatsApp Business number. Send messages, share documents, and receive replies through the same API.",
    useCases: ["Customer support", "Order updates", "Documents and images"],
    features: [
      {
        title: "Start with a template.",
        description:
          "Use approved templates to reach out. Send free-form replies within the 24-hour customer service window.",
      },
      {
        title: "Send more than words.",
        description:
          "Share images and documents alongside text, using the same SDK and API key.",
      },
      {
        title: "A conversation, both ways.",
        description:
          "Receive incoming messages and read receipts through webhooks so your app can respond.",
      },
    ],
    example: {
      method: "whatsapp.send",
      fields: [
        { name: "to", value: "+237670000000" },
        { name: "type", value: "text" },
        { name: "text", value: "Of course. How can we help?" },
      ],
      note: "Text replies require an open 24-hour service window.",
      previewTitle: "Acme Support",
      previewBody: "Of course. How can we help?",
    },
  },
  {
    slug: "telegram",
    name: "Telegram",
    status: "coming-soon",
    summary: "Telegram support is planned.",
    headline: "Telegram is coming next.",
    description:
      "We're bringing Telegram to Retransmit. It isn't available yet. Start building with Email, SMS, and WhatsApp today.",
    useCases: [],
    features: [],
  },
];

export const AVAILABLE_PRODUCTS = PRODUCTS.filter(
  (product) => product.status === "available",
);

export function productHref(product: Pick<Product, "slug">): Route {
  return `/products/${product.slug}` as Route;
}

export function getProduct(slug: string) {
  return PRODUCTS.find((product) => product.slug === slug);
}
