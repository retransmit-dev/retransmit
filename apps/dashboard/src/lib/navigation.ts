/**
 * The product navigation as data.
 *
 * Every routed surface of the app is declared once here and read by three
 * consumers: the sidebar (groups, labels, icons, hrefs, active state), the
 * page header (title, description) and each route's metadata. Adding a
 * screen means adding a row below plus the matching `page.tsx` under
 * `src/app/(dashboard)/`.
 *
 * `href` is typed as Next's `Route`, and `typedRoutes` is on, so every path
 * below is checked against the routes that actually exist. Deleting a
 * `page.tsx` without deleting its row fails `check-types` rather than shipping
 * a sidebar link that 404s.
 *
 * The menu is flat and wide rather than deep: one unlabelled row for the
 * overview, then three labelled groups. Every row is a destination; nothing
 * expands.
 */

import {
  BanIcon,
  ChartLineIcon,
  GlobeIcon,
  HouseIcon,
  KeyRoundIcon,
  LayersIcon,
  type LucideIcon,
  MailIcon,
  MessageCircleIcon,
  Settings2Icon,
  WebhookIcon,
} from "lucide-react";
import type { Metadata, Route } from "next";

export type NavPage = {
  /** Route, root-relative and without a trailing slash. */
  href: Route;
  /** Sidebar label and `<h1>`. Short. */
  title: string;
  /** The one-line answer to "what is this screen for". Also the meta description. */
  description: string;
};

export type NavSection = NavPage & {
  icon: LucideIcon;
  /** Child screens. Tabs inside a section rather than rows in the menu. */
  items?: NavPage[];
};

/** A block of the sidebar. Unlabelled groups render as bare rows. */
export type NavGroup = {
  label?: string;
  sections: NavSection[];
};

const overview: NavSection = {
  href: "/",
  title: "Overview",
  description: "Add a domain, create an API key, and start sending.",
  icon: HouseIcon,
};

/* -- Messages ------------------------------------------------------------ */

const emails: NavSection = {
  href: "/emails",
  title: "Emails",
  description: "Every email sent through your account, with delivery status.",
  icon: MailIcon,
};

const batches: NavSection = {
  href: "/batches",
  title: "Batches",
  description: "Bulk sends and how far each one has drained, with a count per status.",
  icon: LayersIcon,
};

const whatsapp: NavSection = {
  href: "/whatsapp",
  title: "WhatsApp",
  description:
    "Connect a WhatsApp Business number to send from it with your API key.",
  icon: MessageCircleIcon,
};

const analytics: NavSection = {
  href: "/analytics",
  title: "Analytics",
  description: "Delivery and engagement for the emails you send.",
  icon: ChartLineIcon,
};

/* -- Configure ----------------------------------------------------------- */

const domains: NavSection = {
  href: "/domains",
  title: "Domains",
  description: "Verify a domain to send email from any address on it.",
  icon: GlobeIcon,
};

const apiKeys: NavSection = {
  href: "/api-keys",
  title: "API keys",
  description: "Authenticate requests to the Retransmit API.",
  icon: KeyRoundIcon,
};

const webhooks: NavSection = {
  href: "/webhooks",
  title: "Webhooks",
  description: "Get notified about deliveries, bounces, and complaints.",
  icon: WebhookIcon,
};

const suppressions: NavSection = {
  href: "/suppressions",
  title: "Suppressions",
  description:
    "Addresses this organization will not send to. Hard bounces and spam complaints are added automatically; you can also add or import addresses yourself. Removing an entry makes the address sendable again.",
  icon: BanIcon,
};

/* -- Account ------------------------------------------------------------- */

const settings: NavSection = {
  href: "/settings",
  title: "Settings",
  description:
    "Manage your organization. Domains, suppressions, and sending are shared with everyone in it.",
  icon: Settings2Icon,
  items: [
    {
      href: "/settings/general",
      title: "General",
      description: "The organization's name and your role in it.",
    },
    {
      href: "/settings/team",
      title: "Team",
      description:
        "People with access to this organization, and what each can do.",
    },
  ],
};

export const navGroups: NavGroup[] = [
  { sections: [overview] },
  { label: "Messages", sections: [emails, batches, whatsapp, analytics] },
  { label: "Configure", sections: [domains, apiKeys, webhooks, suppressions] },
  { label: "Account", sections: [settings] },
];

/** Every menu row, in sidebar order, groups flattened away. */
export const navSections: NavSection[] = navGroups.flatMap(
  (group) => group.sections,
);

/**
 * Every routed page in the registry, deduplicated by href — a page that is
 * both a menu row and a child of some section is still one page.
 */
export const navPages: NavPage[] = [
  ...new Map(
    navSections
      .flatMap((section) => [section, ...(section.items ?? [])])
      .map((page) => [page.href, page] as const),
  ).values(),
];

/** The registry row for a path, or undefined for a route the sidebar does not own. */
export function findNavPage(href: string): NavPage | undefined {
  return navPages.find((page) => page.href === href);
}

/**
 * The one menu row that should read as current: longest matching prefix wins.
 * A row stays lit for everything underneath it, so `/settings/team` lights
 * Settings. The overview row is exact-match only, since every path is under `/`.
 */
export function activeNavHref(pathname: string): string | undefined {
  let best: string | undefined;

  for (const { href } of navSections) {
    const matches =
      href === "/"
        ? pathname === "/"
        : pathname === href || pathname.startsWith(`${href}/`);

    if (matches && (!best || href.length > best.length)) best = href;
  }

  return best;
}

/** Page metadata straight from the registry, so a title is never typed twice. */
export function navMetadata(href: Route): Metadata {
  const page = findNavPage(href);
  if (!page) return {};
  return { title: page.title, description: page.description };
}
