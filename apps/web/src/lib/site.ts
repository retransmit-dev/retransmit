export const siteConfig = {
  name: "Retransmit",
  tagline: "Messaging API for developers",
  description:
    "Email, SMS, and WhatsApp for developers. One API, one typed Node.js SDK, signed webhooks, and a prepaid balance. Use the cloud or self-host. Telegram is coming soon.",
  url: "https://retransmit.dev",
  links: {
    /* The dashboard: sign-in and sign-up both land here, and a signed-in
       visitor goes straight to their workspace. */
    app: "https://app.retransmit.dev",
    docs: "https://docs.retransmit.dev",
    quickstart: "https://docs.retransmit.dev/quickstart",
    apiReference: "https://docs.retransmit.dev/api-reference",
    webhooks: "https://docs.retransmit.dev/webhooks",
    github: "https://github.com/retransmit-dev/retransmit",
    npm: "https://www.npmjs.com/package/retransmit.dev",
  },
} as const;

export function absoluteUrl(path: string) {
  return path === "/" ? siteConfig.url : `${siteConfig.url}${path}`;
}

/* Referenced explicitly in per-page metadata because Next replaces rather
   than merges `openGraph`, so every page must restate its images. */
export const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${siteConfig.name}, ${siteConfig.tagline.toLowerCase()}`,
} as const;
