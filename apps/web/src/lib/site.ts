export const siteConfig = {
  name: "Retransmit",
  tagline: "Messaging API for developers",
  description:
    "Transactional email and SMS for developers: one API, one typed Node.js SDK, one prepaid balance. Batch sending, signed webhooks, WhatsApp next. Use the cloud or self-host the whole stack.",
  url: "https://retransmit.dev",
  links: {
    docs: "https://docs.retransmit.dev",
    quickstart: "https://docs.retransmit.dev/quickstart",
    apiReference: "https://docs.retransmit.dev/api-reference",
    webhooks: "https://docs.retransmit.dev/webhooks",
    github: "https://github.com/jpainam/retransmit",
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
