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
      "Welcome emails, receipts, and account updates, sent from your own domain.",
    useCases: ["Welcome emails", "Order receipts", "Account updates"],
    features: [
      {
        title: "Your own domain",
        description:
          "Verify it with SPF and DKIM. We give you the DNS records to add.",
      },
      {
        title: "Batch sending",
        description:
          "Queue up to 10,000 emails in one request. Each one gets its own ID and event history.",
      },
      {
        title: "Delivery tracking",
        description:
          "Deliveries, opens, and bounces reach your webhook, signed.",
      },
    ],
    example: {
      method: "emails.send",
      fields: [
        { name: "from", value: "Acme <hello@acme.com>" },
        { name: "to", value: "jane@example.com" },
        { name: "subject", value: "Welcome to Acme" },
        { name: "html", value: "<p>Your account is ready.</p>" },
      ],
      previewTitle: "Welcome to Acme",
      previewBody: "Your account is ready.",
    },
  },
  {
    slug: "sms",
    name: "SMS",
    status: "available",
    summary: "Verification codes and time-sensitive alerts.",
    headline: "SMS from the same API.",
    description:
      "Verification codes, delivery updates, and reminders. Routing is handled per country.",
    useCases: [
      "Verification codes",
      "Delivery updates",
      "Appointment reminders",
    ],
    features: [
      {
        title: "Routing",
        description:
          "The destination number sets the country. We pick the cheapest configured provider for it.",
      },
      {
        title: "Sender ID",
        description:
          "Use your own sender ID where the country allows it, or the default for the route.",
      },
      {
        title: "Delivery receipts",
        description:
          "Receipts arrive by signed webhook. Every message keeps its event history.",
      },
    ],
    example: {
      method: "sms.send",
      fields: [
        { name: "from", value: "Acme" },
        { name: "to", value: "+237670000000" },
        { name: "text", value: "Your order is on its way." },
      ],
      previewTitle: "Acme",
      previewBody: "Your order is on its way.",
    },
  },
  {
    slug: "whatsapp",
    name: "WhatsApp",
    status: "available",
    summary: "Templates, media, and customer replies.",
    headline: "Send and receive WhatsApp messages.",
    description:
      "Connect your WhatsApp Business number. Send templates, media, and replies through the same API.",
    useCases: ["Customer support", "Order updates", "Documents and images"],
    features: [
      {
        title: "Templates",
        description:
          "Open a conversation with an approved template. Reply free-form inside the 24-hour window.",
      },
      {
        title: "Media",
        description: "Send images and documents with the same call.",
      },
      {
        title: "Replies",
        description: "Incoming messages and read receipts reach your webhook.",
      },
    ],
    example: {
      method: "whatsapp.send",
      fields: [
        { name: "to", value: "+237670000000" },
        { name: "type", value: "text" },
        { name: "text", value: "Of course. How can we help?" },
      ],
      note: "Text replies need an open 24-hour service window.",
      previewTitle: "Acme Support",
      previewBody: "Of course. How can we help?",
    },
  },
  {
    slug: "telegram",
    name: "Telegram",
    status: "coming-soon",
    summary: "Telegram support is planned.",
    headline: "Telegram is next.",
    description: "Telegram isn't available yet. Email, SMS, and WhatsApp are.",
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
