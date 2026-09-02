import type { Route } from "next";

/* Every indexable route is declared once here and read by four consumers:
   the footer (labels and hrefs), sitemap.ts (which URLs to submit), each
   route's metadata (title, description, canonical), and the compare hub.
   `typedRoutes` checks `href`, so a deleted page.tsx fails the build. */

export type PageGroup = "compare" | "legal";

export type SitePage = {
  href: Route;
  /* Footer and breadcrumb label. */
  label: string;
  /* <title> before the site-name template is applied. */
  title: string;
  /* Meta description, also shown on the compare hub card. */
  description: string;
  group: PageGroup;
  /* Only published pages enter the sitemap; the rest are noindex,follow. */
  published?: boolean;
  priority?: number;
  changeFrequency?: "daily" | "weekly" | "monthly" | "yearly";
};

export const SITE_PAGES: readonly SitePage[] = [
  {
    href: "/compare",
    label: "Compare",
    title: "Compare email APIs",
    description:
      "Side-by-side comparisons of Retransmit, Resend, useSend, Plunk, and eusend. Pricing, features, deliverability, and self-hosting, checked against each vendor's own pages.",
    group: "compare",
    published: true,
    priority: 0.8,
    changeFrequency: "weekly",
  },
  {
    href: "/compare/resend-alternatives",
    label: "Resend alternatives",
    title: "Best Resend alternatives in 2026",
    description:
      "Four Resend alternatives compared on price, features, and self-hosting: Retransmit, useSend, Plunk, and eusend. Includes a full pricing table checked on September 1, 2026.",
    group: "compare",
    published: true,
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    href: "/compare/open-source-email-api",
    label: "Open source email APIs",
    title: "Open source email API comparison",
    description:
      "Retransmit, useSend, and Plunk are open source email platforms you can self-host. This comparison covers licenses, cloud pricing, features, and what self-hosting actually takes.",
    group: "compare",
    published: true,
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    href: "/compare/retransmit-vs-resend",
    label: "Retransmit vs Resend",
    title: "Retransmit vs Resend",
    description:
      "Retransmit and Resend compared: pricing models, sending features, webhooks, deliverability, and self-hosting. An honest table of what each does that the other does not.",
    group: "compare",
    published: true,
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    href: "/compare/retransmit-vs-usesend",
    label: "Retransmit vs useSend",
    title: "Retransmit vs useSend",
    description:
      "Retransmit and useSend are both open source email platforms built on Amazon SES. This comparison covers pricing, marketing features, SDKs, webhooks, and self-hosting.",
    group: "compare",
    published: true,
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    href: "/compare/retransmit-vs-plunk",
    label: "Retransmit vs Plunk",
    title: "Retransmit vs Plunk",
    description:
      "Retransmit and Plunk compared: transactional focus vs all-in-one marketing, pricing per thousand emails, webhooks, automations, and what self-hosting looks like for each.",
    group: "compare",
    published: true,
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    href: "/compare/retransmit-vs-eusend",
    label: "Retransmit vs eusend",
    title: "Retransmit vs eusend",
    description:
      "Retransmit and eusend compared: prepaid credits vs EU-metered plans, batch sending, webhooks, SDKs, and data residency. Both are transactional-first email APIs.",
    group: "compare",
    published: true,
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    href: "/privacy",
    label: "Privacy policy",
    title: "Privacy policy",
    description:
      "What Retransmit collects, why, and what you can do about it. Covers account data from Google and GitHub sign-in, email logs, retention, and deletion.",
    group: "legal",
    published: true,
    priority: 0.3,
    changeFrequency: "yearly",
  },
  {
    href: "/terms",
    label: "Terms of service",
    title: "Terms of service",
    description:
      "The terms that govern the Retransmit hosted service: accounts, acceptable use, prepaid credits, suspension, and liability.",
    group: "legal",
    published: true,
    priority: 0.3,
    changeFrequency: "yearly",
  },
] as const;

const BY_HREF = new Map(SITE_PAGES.map((page) => [page.href, page]));

export function getPage(href: Route): SitePage {
  const page = BY_HREF.get(href);
  if (!page) throw new Error(`No entry in SITE_PAGES for "${href}"`);
  return page;
}

export function publishedPages() {
  return SITE_PAGES.filter((page) => page.published === true);
}

export function pagesInGroup(group: PageGroup) {
  return SITE_PAGES.filter((page) => page.group === group);
}
