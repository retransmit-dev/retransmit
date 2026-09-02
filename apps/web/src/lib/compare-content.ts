import type { SeoContentPageProps } from "@/components/marketing/seo-content-page";
import { siteConfig } from "@/lib/site";

/* All competitor numbers on this page were read from the vendors' own
   sites on September 1, 2026. When a price changes, update the cell and
   the `note` under the table together. Never invent a number: if a vendor
   does not publish one, the cell says so. */

const VERIFIED_NOTE =
  "Prices and limits read from each vendor's official site on September 1, 2026, before tax. Confirm the current offer before you buy.";

const DISCLOSURE =
  "Retransmit builds one of the products compared here. Every competitor number was checked on the vendor's own site on the date above, and nothing on this page is paid placement.";

const EDITORIAL = {
  datePublished: "2026-09-01",
  dateModified: "2026-09-01",
  dateModifiedLabel: "September 1, 2026",
  disclosure: DISCLOSURE,
} as const;

const RESEND_PRICING = {
  label: "Resend pricing",
  href: "https://resend.com/pricing",
} as const;
const USESEND_SITE = {
  label: "useSend",
  href: "https://usesend.com/",
} as const;
const PLUNK_PRICING = {
  label: "Plunk pricing",
  href: "https://www.useplunk.com/pricing",
} as const;
const EUSEND_PRICING = {
  label: "eusend pricing",
  href: "https://eusend.dev/pricing",
} as const;

const DOCS_RESOURCE = {
  href: siteConfig.links.quickstart,
  label: "Retransmit quickstart",
  description:
    "Verify a domain, grab an API key, and send your first email in under five minutes.",
} as const;

const WEBHOOKS_RESOURCE = {
  href: siteConfig.links.webhooks,
  label: "Webhook docs",
  description:
    "Nine event types, HMAC-SHA256 signatures, and a five line verification example.",
} as const;

export const COMPARE_CONTENT = {
  /* ------------------------------------------------------------------ */
  vsResend: {
    href: "/compare/retransmit-vs-resend",
    section: { name: "Compare", href: "/compare" },
    title: "Retransmit vs Resend",
    lead: "Resend is the polished default for developer email, with nine SDKs and a marketing suite. Retransmit is the small open stack you can read, self-host, and fund with prepaid credits instead of a card on file. Here is where each one wins.",
    summary:
      "Both products are transactional email APIs aimed at developers. Resend is a proprietary platform with a large feature surface: marketing broadcasts, audiences, automations, inbound email, and multi-region sending. Retransmit is deliberately narrower. It does transactional sending, batching, logs, and signed webhooks, its source is public, and its cloud runs on prepaid credits you can top up by bank transfer or mobile money. The tables below compare pricing, features, and deliverability line by line.",
    editorial: EDITORIAL,
    sections: [
      {
        title: "At a glance",
        body: [
          "The short version: pick Resend for breadth and polish, pick Retransmit for ownership and a pricing model with no subscription.",
        ],
        table: {
          columns: ["", "Retransmit", "Resend"],
          rows: [
            [
              "Positioning",
              "Open email API you can run in our cloud or yours",
              "Email for developers, transactional plus marketing",
            ],
            [
              "Source code",
              "AGPL-3.0 on GitHub, MIT licensed SDK",
              "Proprietary. Its React Email library is open source",
            ],
            ["Self-hosting", "Yes, free forever", "No"],
            [
              "Free tier",
              "Self-hosted is free with every feature",
              "3,000 emails a month, capped at 100 a day",
            ],
            [
              "Paid model",
              "Prepaid credits, no subscription or seats",
              "Monthly tiers from $20, plus opt-in overage",
            ],
            [
              "SDKs",
              "Node.js, plus plain REST from any language",
              "Node.js, PHP, Python, Ruby, Go, Rust, Java, Elixir, .NET",
            ],
            [
              "Best fit",
              "Teams that want to own the stack or pay without an international card",
              "Teams that want everything managed in one place",
            ],
          ],
          note: VERIFIED_NOTE,
        },
        sources: [RESEND_PRICING],
      },
      {
        title: "Pricing",
        body: [
          "Resend prices in monthly tiers. Free covers 3,000 emails a month with a hard cap of 100 a day and 3 domains. Pro is $20 a month for 50,000 emails, Scale is $90 for 100,000, and paid plans can opt into overage at $0.90 per 1,000 extra emails. Dedicated IPs are a $30 a month add-on on Scale, and SSO costs $150 a month.",
          "Retransmit has no tiers. Self-hosting is free forever with every feature, no license key, and no phone-home. The cloud runs on one prepaid balance that only moves when a message does. You can fund it in your local currency, including bank transfer and mobile money, which matters in markets where a USD card is hard to get.",
        ],
        table: {
          columns: ["", "Retransmit", "Resend"],
          rows: [
            [
              "Free",
              "Self-hosted, unlimited features, your own SES credentials",
              "3,000 emails a month, 100 a day, 3 domains",
            ],
            [
              "Entry paid",
              "Top up prepaid credits, any amount",
              "Pro, $20 a month for 50,000 emails",
            ],
            [
              "100,000 emails a month",
              "Prepaid, pay per send",
              "Scale, $90 a month",
            ],
            [
              "Overage",
              "None. Sending draws down the balance",
              "$0.90 per 1,000 emails, opt-in, paid plans only",
            ],
            ["Dedicated IP", "Not offered", "$30 a month, Scale plan only"],
            ["SSO", "Not offered", "$150 a month on Scale"],
            [
              "Payment methods",
              "Bank transfer, mobile money, local currency",
              "Card",
            ],
          ],
          note: VERIFIED_NOTE,
        },
        sources: [RESEND_PRICING],
      },
      {
        title: "Sending features",
        body: [
          "Resend covers far more surface area today. Retransmit ships transactional sending, batching, and delivery tracking, and is honest about the rest: marketing tools, templates, and audiences are not built yet.",
        ],
        table: {
          columns: ["Feature", "Retransmit", "Resend"],
          rows: [
            ["Transactional API", "Yes", "Yes"],
            [
              "Batch sending",
              "Yes, up to 10,000 emails in one request",
              "Yes",
            ],
            ["Scheduled sending", "Not yet", "Yes"],
            ["Marketing broadcasts", "Not yet", "Yes"],
            ["Templates and editor", "Not yet", "Yes"],
            ["Contacts and audiences", "Not yet", "Yes"],
            ["Automations", "Not yet", "Yes, metered per run"],
            ["Inbound email", "Not yet", "Yes"],
            ["SMTP relay", "Not yet", "Yes"],
            ["Multi-region sending", "No", "Yes, four regions"],
          ],
          note: VERIFIED_NOTE,
        },
      },
      {
        title: "Webhooks and deliverability",
        body: [
          "This is where Retransmit punches above its size. Every send is queued and retried with exponential backoff, and every event is delivered to your endpoint with an HMAC-SHA256 signature over the timestamp and body, retried up to 8 times. Resend signs webhooks too and adds a managed deliverability layer: dedicated IPs with auto warm-up, blocklist monitoring, and deliverability insights.",
        ],
        table: {
          columns: ["", "Retransmit", "Resend"],
          rows: [
            [
              "Event webhooks",
              "9 event types, from sent to complained",
              "Delivery, open, click, bounce, complaint events",
            ],
            [
              "Webhook signing",
              "HMAC-SHA256, timestamped, 8 retries with backoff",
              "Signed endpoints, per-plan endpoint limits",
            ],
            ["SPF and DKIM", "Yes, records shown in the dashboard", "Yes"],
            [
              "Bounce and complaint handling",
              "Automatic suppression",
              "Automatic, dynamic suppression list",
            ],
            [
              "Dedicated IPs",
              "No",
              "Yes, $30 a month with auto warm-up, Scale only",
            ],
            [
              "Email logs",
              "Full event history per email, by id",
              "Logs with 30 day retention on self-serve plans",
            ],
          ],
          note: VERIFIED_NOTE,
        },
        sources: [RESEND_PRICING],
      },
      {
        title: "Self-hosting and ownership",
        body: [
          "Resend cannot be self-hosted. Retransmit's API, dashboard, queue, and SDK live in one public repository, and moving between cloud and self-hosted is a base URL change. Self-hosting brings your own Amazon SES credentials, so your quota and reputation are yours.",
        ],
        points: [
          "Same SDK, dashboard, and webhooks in cloud and self-hosted mode.",
          "No license key and no phone-home when you run it yourself.",
          "Data stays on your servers when self-hosted, which simplifies compliance reviews.",
        ],
      },
      {
        title: "Which one should you pick",
        body: [],
        points: [
          "Pick Resend if you want marketing, automations, inbound, many SDKs, and a managed deliverability team behind you.",
          "Pick Resend if you need dedicated IPs or multi-region sending today.",
          "Pick Retransmit if you want to read and run the stack yourself, free, on your own SES account.",
          "Pick Retransmit if subscriptions do not fit how you pay, and prepaid credits by bank transfer or mobile money do.",
          "Pick Retransmit if your workload is transactional sending with batching and webhooks, and you do not want to pay for a suite around it.",
        ],
      },
    ],
    resources: [
      {
        href: "/compare/resend-alternatives",
        label: "Best Resend alternatives in 2026",
        description:
          "Four alternatives compared on price, features, and self-hosting.",
      },
      {
        href: "/compare/open-source-email-api",
        label: "Open source email API comparison",
        description: "Retransmit, useSend, and Plunk, side by side.",
      },
      DOCS_RESOURCE,
      WEBHOOKS_RESOURCE,
    ],
    faqs: [
      {
        q: "Is Retransmit a Resend alternative?",
        a: "For transactional email, yes. Retransmit covers the core Resend workflow: verify a domain, send through an API or Node.js SDK, batch up to 10,000 emails in one request, and receive signed webhooks. It does not yet cover Resend's marketing, template, automation, or inbound features.",
      },
      {
        q: "Is Resend open source?",
        a: "The Resend platform is proprietary. Its React Email template library is open source, but you cannot self-host Resend itself. Retransmit is AGPL-3.0 on GitHub and the whole stack can be self-hosted for free.",
      },
      {
        q: "What does Resend cost at 50,000 emails a month?",
        a: "As of September 1, 2026, Resend's Pro plan covers 50,000 emails a month for $20, with opt-in overage at $0.90 per 1,000 extra emails. Retransmit's cloud has no monthly plan. You top up a prepaid balance and pay per send.",
      },
      {
        q: "Can I migrate from Resend to Retransmit?",
        a: "The API shapes are close. Both SDKs return a { data, error } result instead of throwing, and both use domain verification with SPF and DKIM. Point your sends at the Retransmit API, verify your domain, and re-create your webhook endpoints.",
      },
      {
        q: "Does Retransmit support marketing emails?",
        a: "Not yet. Retransmit is transactional-first: API sends, batches, logs, and webhooks. If you need broadcasts, audiences, or an email editor today, Resend, useSend, or Plunk are better fits.",
      },
    ],
    cta: "Own your email stack. Send through the cloud with prepaid credits, or run the same code yourself for free.",
  },

  /* ------------------------------------------------------------------ */
  vsUsesend: {
    href: "/compare/retransmit-vs-usesend",
    section: { name: "Compare", href: "/compare" },
    title: "Retransmit vs useSend",
    lead: "Retransmit and useSend are both open source email platforms built on Amazon SES. useSend adds a full marketing suite. Retransmit stays transactional and adds prepaid billing you can fund without a card.",
    summary:
      "These two are the closest pair in this comparison series. Both are open source, both self-host, and both send through Amazon SES under the hood. The differences are focus and billing. useSend, formerly Unsend, bundles marketing campaigns, a contact CRM, an email editor, and SMTP alongside its API, and bills usage monthly with a $10 minimum. Retransmit ships a smaller transactional core with batch sending and signed webhooks, and its cloud runs on prepaid credits with local payment methods.",
    editorial: EDITORIAL,
    sections: [
      {
        title: "At a glance",
        body: [
          "Both projects believe you should be able to read and run your email stack. They differ on how much product sits on top of SES.",
        ],
        table: {
          columns: ["", "Retransmit", "useSend"],
          rows: [
            [
              "Positioning",
              "Transactional email API, cloud or self-hosted",
              "Open source email platform for product, transactional, and marketing email",
            ],
            [
              "Source code",
              "AGPL-3.0 on GitHub, MIT licensed SDK",
              "AGPL-3.0 on GitHub",
            ],
            ["Self-hosting", "Yes, free", "Yes, Docker and Railway guides"],
            ["Underlying infrastructure", "Amazon SES", "Amazon SES, stated openly"],
            [
              "Free cloud tier",
              "Prepaid credits, pay per send",
              "3,000 emails a month, 100 a day, 1 domain, 1 seat",
            ],
            [
              "Paid model",
              "Prepaid balance, no minimum",
              "$10 a month minimum usage",
            ],
            [
              "Best fit",
              "Transactional sending with batching and webhooks",
              "Product plus marketing email against one contact list",
            ],
          ],
          note: VERIFIED_NOTE,
        },
        sources: [USESEND_SITE],
      },
      {
        title: "Pricing",
        body: [
          "useSend prices per email with a $10 monthly minimum: $0.40 per 1,000 transactional emails and $1.00 per 1,000 marketing emails, with unlimited domains, seats, and contact books on paid. Its free tier covers 3,000 emails a month on one domain with one seat.",
          "Retransmit's cloud is a prepaid balance with no monthly minimum. Fund it by bank transfer or mobile money in your local currency, and it only moves when a message sends. Self-hosting either product is free.",
        ],
        table: {
          columns: ["", "Retransmit", "useSend"],
          rows: [
            [
              "Free tier",
              "Self-hosted, every feature",
              "3,000 emails a month, 100 a day, 1 domain",
            ],
            [
              "Monthly minimum",
              "None, prepaid credits",
              "$10 of usage a month on paid",
            ],
            [
              "Transactional price",
              "Prepaid, pay per send",
              "$0.40 per 1,000 emails",
            ],
            [
              "Marketing price",
              "Not offered yet",
              "$1.00 per 1,000 emails",
            ],
            [
              "Contacts",
              "No contact storage, nothing to pay for",
              "Free, unlimited contacts on paid plans",
            ],
            [
              "Payment methods",
              "Bank transfer, mobile money, local currency",
              "Card",
            ],
          ],
          note: VERIFIED_NOTE,
        },
        sources: [USESEND_SITE],
      },
      {
        title: "Feature comparison",
        body: [
          "useSend has the wider product: campaigns, a Notion-style editor, contact books with consent tracking, SMTP, and scheduling. Retransmit counters with a bigger batch API and a heavier webhook system.",
        ],
        table: {
          columns: ["Feature", "Retransmit", "useSend"],
          rows: [
            ["Transactional API", "Yes", "Yes"],
            [
              "Batch sending",
              "Yes, 10,000 per request with per-status counts",
              "Yes",
            ],
            ["Scheduled sending", "Not yet", "Yes, with update and cancel"],
            ["Marketing campaigns", "Not yet", "Yes"],
            ["Email editor", "Not yet", "Yes, WYSIWYG"],
            ["Contact management", "Not yet", "Yes, books, lists, consent"],
            ["SMTP relay", "Not yet", "Yes"],
            ["Automations", "Not yet", "No"],
            ["Inbound email", "Not yet", "No"],
            [
              "SDKs",
              "Node.js, plus REST",
              "TypeScript, Python, Go, PHP",
            ],
            [
              "Webhooks",
              "9 event types, HMAC signed, 8 retries",
              "Yes, account event webhooks",
            ],
            [
              "Analytics",
              "Per-email logs and event history",
              "Dashboard with opens, clicks, bounces, exports",
            ],
          ],
          note: VERIFIED_NOTE,
        },
      },
      {
        title: "Self-hosting",
        body: [
          "Both stacks self-host, both bring your own SES credentials, and both keep the dashboard when you do. Both are AGPL-3.0, which requires you to publish modifications if you offer the software over a network. Retransmit's SDK is MIT on its own, so client code embeds it without restrictions.",
          "Practically: useSend has more moving parts to run because it is more product. Retransmit is a smaller deployment, and switching between its cloud and your own instance is a base URL change in the SDK.",
        ],
      },
      {
        title: "Which one should you pick",
        body: [],
        points: [
          "Pick useSend if you want marketing campaigns, contacts, and transactional email in one open source tool.",
          "Pick useSend if you need SMTP today, for example with Supabase auth emails.",
          "Pick Retransmit if your workload is API-driven transactional sending and you want the stronger batch and webhook story.",
          "Pick Retransmit if prepaid credits and local payment methods fit you better than a monthly usage bill on a card.",
        ],
      },
    ],
    resources: [
      {
        href: "/compare/open-source-email-api",
        label: "Open source email API comparison",
        description: "Retransmit, useSend, and Plunk, side by side.",
      },
      {
        href: "/compare/retransmit-vs-plunk",
        label: "Retransmit vs Plunk",
        description:
          "Transactional focus against an all-in-one marketing platform.",
      },
      DOCS_RESOURCE,
      WEBHOOKS_RESOURCE,
    ],
    faqs: [
      {
        q: "Are Retransmit and useSend both built on Amazon SES?",
        a: "Yes. useSend says so on its homepage, and Retransmit sends through SES in the cloud and with your own SES credentials when self-hosted. Both add queuing, domain verification, logs, and webhooks on top of the raw SES API.",
      },
      {
        q: "What does useSend cost?",
        a: "As of September 1, 2026, useSend's cloud is free for 3,000 emails a month, then usage-priced with a $10 monthly minimum: $0.40 per 1,000 transactional emails and $1.00 per 1,000 marketing emails. Self-hosting is free.",
      },
      {
        q: "Which is easier to self-host?",
        a: "Both ship Docker-based setups and documented guides. Retransmit is a smaller surface, one repository with API, dashboard, queue, and SDK. useSend carries more product, including campaigns and contacts, so there is more to operate.",
      },
      {
        q: "Does Retransmit have a contact list or campaign tool like useSend?",
        a: "No. Retransmit is transactional-first and does not store contacts or send campaigns yet. If marketing email is a hard requirement today, useSend or Plunk fit better.",
      },
    ],
    cta: "Both are open. One is smaller. If your email is transactional, try the stack built for exactly that.",
  },

  /* ------------------------------------------------------------------ */
  vsPlunk: {
    href: "/compare/retransmit-vs-plunk",
    section: { name: "Compare", href: "/compare" },
    title: "Retransmit vs Plunk",
    lead: "Plunk folds transactional email, campaigns, and automations into one open source tool with one contact list. Retransmit does one job, transactional delivery, and does it with bigger batches and heavier webhooks.",
    summary:
      "Plunk's pitch is replacing your email API and your marketing tool at once: workflows, segments, inbound email, a visual editor, and a flat price of $1.00 per 1,000 emails. Retransmit's pitch is owning a focused transactional pipeline: API and SDK sends, 10,000-email batches, per-email event history, and HMAC-signed webhooks, funded by prepaid credits or self-hosted for free. Which one fits depends on whether email is a product surface for you or an infrastructure concern.",
    editorial: EDITORIAL,
    sections: [
      {
        title: "At a glance",
        body: [
          "Both are open source and self-hostable. Plunk optimizes for breadth, Retransmit for the transactional core.",
        ],
        table: {
          columns: ["", "Retransmit", "Plunk"],
          rows: [
            [
              "Positioning",
              "Transactional email API, cloud or self-hosted",
              "Open source platform for transactional, campaigns, and automations",
            ],
            [
              "Source code",
              "AGPL-3.0 on GitHub, MIT licensed SDK",
              "AGPL-3.0 on GitHub",
            ],
            [
              "Self-hosting",
              "Yes, free",
              "Yes, Docker Compose, no per-email cost",
            ],
            [
              "Cloud hosting",
              "Prepaid credits",
              "EU-hosted, $1.00 per 1,000 emails",
            ],
            [
              "Free tier",
              "Self-hosted, every feature",
              "1,000 emails a month with Plunk branding",
            ],
            [
              "SDKs",
              "Node.js, plus REST",
              "Node.js, plus REST and SMTP",
            ],
            [
              "Best fit",
              "Backends that send receipts, alerts, and OTPs at volume",
              "Products that want marketing and lifecycle email too",
            ],
          ],
          note: VERIFIED_NOTE,
        },
        sources: [PLUNK_PRICING],
      },
      {
        title: "Pricing",
        body: [
          "Plunk is refreshingly simple: $1.00 per 1,000 emails, every feature included, unlimited contacts, with an optional monthly spend cap. The free tier covers 1,000 emails a month with Plunk branding on them.",
          "Retransmit is prepaid. Top up a balance, send until it runs out, top up again. No branding on free sends because there is no branded tier; the free option is self-hosting.",
        ],
        table: {
          columns: ["", "Retransmit", "Plunk"],
          rows: [
            [
              "Free tier",
              "Self-hosted, unbranded, every feature",
              "1,000 emails a month, Plunk branding",
            ],
            [
              "Paid price",
              "Prepaid, pay per send",
              "$1.00 per 1,000 emails, all features",
            ],
            ["Contacts", "Not stored", "Free, unlimited"],
            ["Spend control", "Balance runs down, never over", "Optional monthly spend cap"],
            [
              "Payment methods",
              "Bank transfer, mobile money, local currency",
              "Card",
            ],
          ],
          note: VERIFIED_NOTE,
        },
        sources: [PLUNK_PRICING],
      },
      {
        title: "Feature comparison",
        body: [
          "Plunk's automations are its standout: event-triggered workflows with waits and branches, live segments, and inbound email that turns replies into contacts. Retransmit's standouts are operational: batching, queues with backoff, and a webhook system built like a payments provider's.",
        ],
        table: {
          columns: ["Feature", "Retransmit", "Plunk"],
          rows: [
            ["Transactional API", "Yes", "Yes"],
            [
              "Batch sending",
              "Yes, 10,000 per request",
              "Not documented",
            ],
            ["Marketing campaigns", "Not yet", "Yes, with analytics"],
            ["Automations and workflows", "Not yet", "Yes, visual canvas"],
            ["Segments", "Not yet", "Yes, live query-based"],
            ["Inbound email", "Not yet", "Yes, one MX record"],
            ["Email editor", "Not yet", "Yes, visual and HTML"],
            ["SMTP relay", "Not yet", "Yes"],
            [
              "Webhooks",
              "9 event types, HMAC-SHA256, 8 retries",
              "Event hooks, inbound POSTs to your endpoints",
            ],
            [
              "Domain setup",
              "SPF and DKIM records shown in dashboard",
              "DKIM, SPF, DMARC configured automatically",
            ],
            [
              "Agent tooling",
              "Not yet",
              "MCP server with 23 tools",
            ],
          ],
          note: VERIFIED_NOTE,
        },
      },
      {
        title: "Which one should you pick",
        body: [],
        points: [
          "Pick Plunk if you want lifecycle email: campaigns, automations, and segments against one contact list.",
          "Pick Plunk if inbound email or an editor for non-developers matters.",
          "Pick Retransmit if you send transactional volume from a backend and want batching, queues, and signed webhooks as the core product.",
          "Pick Retransmit if you want prepaid billing with local payment methods, or the smaller stack to self-host.",
        ],
      },
    ],
    resources: [
      {
        href: "/compare/open-source-email-api",
        label: "Open source email API comparison",
        description: "Retransmit, useSend, and Plunk, side by side.",
      },
      {
        href: "/compare/retransmit-vs-usesend",
        label: "Retransmit vs useSend",
        description: "The two SES-based open source stacks compared.",
      },
      DOCS_RESOURCE,
      WEBHOOKS_RESOURCE,
    ],
    faqs: [
      {
        q: "Is Plunk open source?",
        a: "Yes. Plunk's platform is AGPL-3.0 on GitHub and can be self-hosted with Docker Compose at no per-email cost. Retransmit is AGPL-3.0 too, with an MIT licensed SDK and a smaller footprint to run.",
      },
      {
        q: "What does Plunk cost?",
        a: "As of September 1, 2026, Plunk's cloud is $1.00 per 1,000 emails with every feature and unlimited contacts, after a free tier of 1,000 emails a month that carries Plunk branding.",
      },
      {
        q: "Does Retransmit have automations like Plunk?",
        a: "No. Retransmit does not have workflows, segments, or campaigns yet. Its webhook events can drive your own automation in your backend, but there is no visual builder.",
      },
      {
        q: "Which handles high transactional volume better?",
        a: "Retransmit is built around that case: one request queues up to 10,000 emails, a rate-aware worker drains the queue with retries and backoff, and every message keeps its own id, log, and webhook events. Plunk does not document a batch API.",
      },
    ],
    cta: "If email is infrastructure for you, not marketing, start with the stack that treats it that way.",
  },

  /* ------------------------------------------------------------------ */
  vsEusend: {
    href: "/compare/retransmit-vs-eusend",
    section: { name: "Compare", href: "/compare" },
    title: "Retransmit vs eusend",
    lead: "Both are transactional-first email APIs. eusend's promise is EU data residency on its own mail servers. Retransmit's promise is an open stack you can self-host anywhere and fund with prepaid credits.",
    summary:
      "eusend runs its own sending infrastructure in German and Finnish data centres and keeps email data inside the EU, with metered plans from 9 euros a month. It is proprietary. Retransmit takes the opposite path to a similar developer experience: the source is public, you can run it on your own servers in any region, and the cloud bills by prepaid balance instead of a monthly plan. Both send webhooks, both verify domains with SPF and DKIM, and both keep the API small.",
    editorial: EDITORIAL,
    sections: [
      {
        title: "At a glance",
        body: [
          "The core trade: eusend gives you EU residency as a service, Retransmit gives you residency wherever you deploy it.",
        ],
        table: {
          columns: ["", "Retransmit", "eusend"],
          rows: [
            [
              "Positioning",
              "Open email API, cloud or self-hosted",
              "Transactional email built for Europe",
            ],
            ["Source code", "AGPL-3.0 on GitHub, MIT licensed SDK", "Proprietary"],
            ["Self-hosting", "Yes, free, any region", "No"],
            [
              "Infrastructure",
              "Amazon SES, or your own SES credentials",
              "Own mail servers in EU data centres",
            ],
            [
              "Free tier",
              "Self-hosted, every feature",
              "3,000 emails a month, 100 a day, 1 domain",
            ],
            [
              "Paid model",
              "Prepaid credits",
              "From 9 euros a month for 10,000 emails, price falls with volume",
            ],
            [
              "SDKs",
              "Node.js, plus REST",
              "Node.js, Python, Go",
            ],
          ],
          note: VERIFIED_NOTE,
        },
        sources: [EUSEND_PRICING],
      },
      {
        title: "Pricing",
        body: [
          "eusend uses one continuous price curve instead of plan tiers: 10,000 emails a month costs 9 euros at 0.90 euros per 1,000, and the rate falls smoothly to 0.215 euros per 1,000 at 2 million. Sending stops at quota by default, and metered overage is opt-in. The free tier is 3,000 emails a month.",
          "Retransmit's cloud is a prepaid balance with no monthly commitment: it draws down as you send and stops when empty, so cost can never surprise you. Self-hosting is free at any volume.",
        ],
        table: {
          columns: ["", "Retransmit", "eusend"],
          rows: [
            [
              "Free tier",
              "Self-hosted, every feature",
              "3,000 emails a month, 100 a day",
            ],
            [
              "10,000 emails a month",
              "Prepaid, pay per send",
              "9 euros",
            ],
            [
              "2,000,000 emails a month",
              "Prepaid, or self-host for free",
              "About 430 euros at 0.215 euros per 1,000",
            ],
            [
              "Overage",
              "None, balance runs down",
              "Opt-in, otherwise sending stops at quota",
            ],
            [
              "Dedicated IPs",
              "No",
              "Enterprise plans only",
            ],
            [
              "Payment methods",
              "Bank transfer, mobile money, local currency",
              "Card, billed through Polar",
            ],
          ],
          note: VERIFIED_NOTE,
        },
        sources: [EUSEND_PRICING],
      },
      {
        title: "Feature comparison",
        body: [
          "Both keep the feature list short on purpose. eusend adds templates, React Email rendering, a test mode, and broadcasts. Retransmit adds batching at scale and a heavier webhook contract.",
        ],
        table: {
          columns: ["Feature", "Retransmit", "eusend"],
          rows: [
            ["Transactional API", "Yes", "Yes"],
            [
              "Batch sending",
              "Yes, 10,000 per request",
              "Not documented",
            ],
            ["Broadcasts", "Not yet", "Yes, with one-click unsubscribe"],
            ["Templates", "Not yet", "Yes"],
            ["React Email", "Not yet", "Yes, rendered by the SDK"],
            ["Test mode", "Not yet", "Yes, test keys and sandbox domain"],
            ["Scheduling", "Not yet", "Not documented"],
            [
              "Webhooks",
              "9 event types, HMAC-SHA256, 8 retries",
              "Sent, delivered, bounced, complained, with retries",
            ],
            [
              "Data residency",
              "Wherever you self-host, or SES regions in cloud",
              "EU only, by design",
            ],
            ["SMTP relay", "Not yet", "Yes"],
          ],
          note: VERIFIED_NOTE,
        },
      },
      {
        title: "Which one should you pick",
        body: [],
        points: [
          "Pick eusend if EU data residency is a compliance requirement and you want it managed for you.",
          "Pick eusend if you want React Email rendering and a test mode out of the box.",
          "Pick Retransmit if you want to self-host, in the EU or anywhere else, and own the deployment.",
          "Pick Retransmit if you batch large sends or need granular, signed delivery events.",
          "Pick Retransmit if prepaid credits and local payment methods beat a euro card subscription for you.",
        ],
      },
    ],
    resources: [
      {
        href: "/compare/resend-alternatives",
        label: "Best Resend alternatives in 2026",
        description:
          "Four alternatives compared on price, features, and self-hosting.",
      },
      {
        href: "/compare/retransmit-vs-resend",
        label: "Retransmit vs Resend",
        description: "The open stack against the polished default.",
      },
      DOCS_RESOURCE,
      WEBHOOKS_RESOURCE,
    ],
    faqs: [
      {
        q: "Is eusend open source?",
        a: "No. eusend is a proprietary service running its own mail servers in EU data centres. Retransmit is AGPL-3.0 on GitHub and the stack self-hosts for free.",
      },
      {
        q: "Can Retransmit keep my email data in the EU?",
        a: "Yes, by self-hosting it on EU servers with EU-region SES credentials. eusend offers EU residency as a managed guarantee instead, with its own infrastructure in Germany and Finland.",
      },
      {
        q: "What does eusend cost?",
        a: "As of September 1, 2026, eusend is free for 3,000 emails a month, then priced on a curve from 0.90 euros per 1,000 at 10,000 emails a month down to 0.215 euros per 1,000 at 2 million. Sending stops at quota unless you opt into metered overage.",
      },
      {
        q: "Which has the better webhook system?",
        a: "Retransmit delivers nine event types with HMAC-SHA256 signatures over a timestamped payload and retries up to 8 times with backoff. eusend documents four event types with automatic retries. If you build on delivery events, Retransmit gives you more to work with.",
      },
    ],
    cta: "Residency by contract, or residency by deployment. If you want the second, the stack is yours to run.",
  },

  /* ------------------------------------------------------------------ */
  resendAlternatives: {
    href: "/compare/resend-alternatives",
    section: { name: "Compare", href: "/compare" },
    title: "Best Resend alternatives in 2026",
    lead: "Resend is excellent and popular. It is also proprietary, tiered, and card-only. Here are four alternatives compared on price, features, and ownership, with numbers checked on each vendor's own site.",
    summary:
      "The strongest reasons to look past Resend are self-hosting, pricing model, and data residency. This roundup compares four options: Retransmit, an open transactional stack with prepaid billing. useSend, an open source Resend plus marketing suite on Amazon SES. Plunk, an open source all-in-one with automations at a flat price. And eusend, a proprietary EU-resident API on its own mail servers. All four send transactional email through an API with domain verification and webhooks.",
    editorial: EDITORIAL,
    schemaItems: [
      { name: "Retransmit", url: "/" },
      { name: "useSend", url: "https://usesend.com/" },
      { name: "Plunk", url: "https://www.useplunk.com/" },
      { name: "eusend", url: "https://eusend.dev/" },
    ],
    sections: [
      {
        title: "How we evaluated these tools",
        body: [
          "Every number below was read from the vendor's public pricing page or homepage on September 1, 2026. Where a vendor does not publish a number or document a feature, the table says so instead of guessing. Retransmit is our product, so we compare it the way we compare everyone else: by what is actually shipped, including the features it does not have yet.",
        ],
        points: [
          "Pricing is compared at the published rates, before tax, without negotiated discounts.",
          "Features count when the vendor documents them, not when a roadmap promises them.",
          "Open source claims link to the actual repository and license.",
        ],
      },
      {
        title: "The alternatives at a glance",
        body: [
          "Resend's own numbers first, for the baseline: free tier of 3,000 emails a month capped at 100 a day, then $20 a month for 50,000 emails and $90 for 100,000, with opt-in overage at $0.90 per 1,000.",
        ],
        table: {
          columns: [
            "Product",
            "Published price",
            "Free tier",
            "Open source",
            "Self-host",
            "Standout",
          ],
          rows: [
            [
              { label: "Retransmit", href: "/" },
              "Prepaid credits, pay per send",
              "Self-hosted, free forever",
              "AGPL-3.0, MIT SDK",
              "Yes",
              "10,000-email batches, signed webhooks, mobile money billing",
            ],
            [
              { label: "useSend", href: "https://usesend.com/" },
              "$0.40 per 1,000 transactional, $10 a month minimum",
              "3,000 emails a month",
              "AGPL-3.0",
              "Yes",
              "Marketing suite and contacts on Amazon SES",
            ],
            [
              { label: "Plunk", href: "https://www.useplunk.com/" },
              "$1.00 per 1,000 emails, all features",
              "1,000 emails a month, branded",
              "AGPL-3.0",
              "Yes",
              "Automations, segments, and inbound in one tool",
            ],
            [
              { label: "eusend", href: "https://eusend.dev/" },
              "From 9 euros for 10,000, down to 0.215 euros per 1,000",
              "3,000 emails a month",
              "No",
              "No",
              "EU-only infrastructure on its own mail servers",
            ],
            [
              { label: "Resend", href: "https://resend.com/pricing" },
              "$20 a month for 50,000, $90 for 100,000",
              "3,000 emails a month, 100 a day",
              "No",
              "No",
              "Nine SDKs, marketing, automations, dedicated IPs",
            ],
          ],
          note: VERIFIED_NOTE,
        },
        sources: [RESEND_PRICING, USESEND_SITE, PLUNK_PRICING, EUSEND_PRICING],
      },
      {
        title: "Retransmit, the open transactional stack",
        body: [
          "Retransmit covers the core Resend workflow with an open codebase: verify a domain with SPF and DKIM, send through REST or the Node.js SDK, batch up to 10,000 emails in one request, and receive nine webhook event types signed with HMAC-SHA256 and retried with backoff. The cloud runs on prepaid credits you can fund by bank transfer or mobile money, and self-hosting is free with your own SES credentials.",
          "What it does not have yet: marketing broadcasts, templates, contacts, automations, inbound, SMTP, and scheduling. If those are hard requirements, read the useSend and Plunk sections next.",
        ],
        points: [
          "Best for: backends sending receipts, alerts, and OTPs, and teams that want to own the stack.",
          "Migration note: like Resend's SDK, calls return { data, error } instead of throwing.",
        ],
      },
      {
        title: "useSend, open source with a marketing suite",
        body: [
          "useSend, formerly Unsend, is the closest open source clone of the full Resend experience. It pairs a transactional API and SMTP relay with campaigns, a WYSIWYG editor, contact books, scheduling, and analytics, all on Amazon SES, which it states openly. Cloud pricing is usage-based: $0.40 per 1,000 transactional emails and $1.00 per 1,000 marketing emails with a $10 monthly minimum, and the AGPL-3.0 code self-hosts with Docker or Railway.",
        ],
        points: [
          "Best for: replacing Resend plus a broadcast tool with one open source app.",
          "Watch for: no automations or inbound email, and the free tier allows one domain and one seat.",
        ],
        sources: [USESEND_SITE],
      },
      {
        title: "Plunk, the flat-price all-in-one",
        body: [
          "Plunk merges transactional email, campaigns, and event-triggered automations against a single contact list, with live segments, inbound email, and a visual editor. Everything costs $1.00 per 1,000 emails with unlimited contacts, or nothing if you self-host the AGPL-3.0 code. The free cloud tier is 1,000 emails a month with Plunk branding.",
        ],
        points: [
          "Best for: products that want lifecycle email and transactional in one place.",
          "Watch for: one official SDK, Node.js, and no documented batch API or dedicated IPs.",
        ],
        sources: [PLUNK_PRICING],
      },
      {
        title: "eusend, the EU-resident option",
        body: [
          "eusend runs its own mail servers in German and Finnish data centres and promises email data never leaves the EU. The API mirrors Resend's field for field by its own claim, with React Email rendering, templates, test keys, and webhooks. Pricing is one curve: 9 euros for 10,000 emails a month, falling to 0.215 euros per 1,000 at 2 million, and sending stops at quota unless you opt into overage.",
        ],
        points: [
          "Best for: teams with a hard EU data residency requirement.",
          "Watch for: proprietary, no self-hosting, no batch or scheduling documented, and dedicated IPs only on enterprise plans.",
        ],
        sources: [EUSEND_PRICING],
      },
      {
        title: "Switching from Resend",
        body: [
          "All four alternatives use the same building blocks: verify a domain with DNS records, swap the API key and base URL, re-create webhook endpoints. eusend advertises SDK compatibility with Resend's field names. Retransmit and useSend follow the same { data, error } SDK convention Resend uses. Budget a day for DNS propagation and webhook re-verification, and warm up gradually if you move real volume.",
        ],
      },
    ],
    resources: [
      {
        href: "/compare/retransmit-vs-resend",
        label: "Retransmit vs Resend",
        description: "The head-to-head with full pricing and feature tables.",
      },
      {
        href: "/compare/open-source-email-api",
        label: "Open source email API comparison",
        description: "Retransmit, useSend, and Plunk, side by side.",
      },
      DOCS_RESOURCE,
      WEBHOOKS_RESOURCE,
    ],
    faqs: [
      {
        q: "What is the best free Resend alternative?",
        a: "For a permanently free option, self-hosting is the answer: Retransmit, useSend, and Plunk all run free on your own servers. Among cloud free tiers, useSend and eusend match Resend's 3,000 emails a month, while Plunk offers 1,000 with branding.",
      },
      {
        q: "What is the best open source Resend alternative?",
        a: "useSend if you want the marketing suite too, Plunk if you want automations, Retransmit if you want a focused transactional API with batching and signed webhooks. All three self-host.",
      },
      {
        q: "Which Resend alternative is cheapest at 50,000 emails a month?",
        a: "At published rates on September 1, 2026: useSend costs $20 at $0.40 per 1,000, the same as Resend's Pro plan. eusend is around 27 euros on its curve. Plunk is $50 at $1.00 per 1,000 but includes marketing and automations. Self-hosting any open option costs only your infrastructure and SES fees.",
      },
      {
        q: "Do these alternatives support marketing email?",
        a: "useSend and Plunk do, with editors, contacts, and campaigns. eusend has broadcasts with one-click unsubscribe. Retransmit is transactional only for now.",
      },
    ],
    cta: "Try the alternative you can read. Send from our cloud with prepaid credits, or run the whole stack yourself.",
  },

  /* ------------------------------------------------------------------ */
  openSourceEmailApi: {
    href: "/compare/open-source-email-api",
    section: { name: "Compare", href: "/compare" },
    title: "Open source email API comparison",
    lead: "Three email platforms you can read and run yourself: Retransmit, useSend, and Plunk. This is how they differ on license, pricing, features, and what self-hosting actually takes.",
    summary:
      "Proprietary email APIs ask you to trust a black box with your sender reputation and your users' addresses. The open source options remove that trade. All three tools here expose a transactional API, verify domains with standard DNS records, and can be self-hosted with Docker. They differ in scope. Retransmit is a focused transactional pipeline. useSend adds a marketing suite. Plunk adds automations and inbound. All prices below were checked on September 1, 2026.",
    editorial: EDITORIAL,
    schemaItems: [
      { name: "Retransmit", url: "/" },
      { name: "useSend", url: "https://usesend.com/" },
      { name: "Plunk", url: "https://www.useplunk.com/" },
    ],
    sections: [
      {
        title: "Why open source for email",
        body: [
          "Email infrastructure is sticky. Your domain reputation, suppression lists, and delivery history live with the provider, and moving is painful. Open source changes the exit cost: if the cloud product changes pricing or shuts down, you deploy the same code yourself and keep sending. It also means you can audit exactly what happens to recipient data, which shortens compliance conversations.",
        ],
      },
      {
        title: "License and repository",
        body: [
          "License matters if you plan to offer email sending to your own customers. AGPL-3.0 requires publishing your modifications when you serve the software over a network. Check with counsel if you are embedding.",
        ],
        table: {
          columns: ["", "Retransmit", "useSend", "Plunk"],
          rows: [
            [
              "Repository",
              {
                label: "github.com/jpainam/retransmit",
                href: "https://github.com/jpainam/retransmit",
              },
              {
                label: "github.com/usesend/useSend",
                href: "https://github.com/usesend/useSend",
              },
              {
                label: "github.com/useplunk/plunk",
                href: "https://github.com/useplunk/plunk",
              },
            ],
            [
              "License",
              "AGPL-3.0, with an MIT licensed SDK",
              "AGPL-3.0",
              "AGPL-3.0",
            ],
            [
              "What is in the repo",
              "API, dashboard, queue, and SDK",
              "Full platform",
              "API, workers, and dashboard",
            ],
            [
              "Underlying sender",
              "Amazon SES",
              "Amazon SES",
              "Not disclosed",
            ],
          ],
          note: VERIFIED_NOTE,
        },
      },
      {
        title: "Cloud pricing",
        body: [
          "All three fund development with a hosted cloud. The models differ: useSend and Plunk meter monthly, Retransmit is prepaid.",
        ],
        table: {
          columns: ["", "Retransmit", "useSend", "Plunk"],
          rows: [
            [
              "Free tier",
              "Self-hosted, every feature",
              "3,000 emails a month, 1 domain, 1 seat",
              "1,000 emails a month, branded",
            ],
            [
              "Paid",
              "Prepaid credits, pay per send",
              "$0.40 per 1,000 transactional, $10 a month minimum",
              "$1.00 per 1,000, all features",
            ],
            [
              "Contacts",
              "Not stored",
              "Unlimited on paid",
              "Unlimited, free",
            ],
            [
              "Payment",
              "Bank transfer, mobile money, local currency",
              "Card",
              "Card",
            ],
          ],
          note: VERIFIED_NOTE,
        },
        sources: [USESEND_SITE, PLUNK_PRICING],
      },
      {
        title: "Feature comparison",
        body: [
          "Scope is the real differentiator. Match the tool to whether you need transactional only, transactional plus marketing, or lifecycle automation.",
        ],
        table: {
          columns: ["Feature", "Retransmit", "useSend", "Plunk"],
          rows: [
            ["Transactional API", "Yes", "Yes", "Yes"],
            [
              "Batch sending",
              "Yes, 10,000 per request",
              "Yes",
              "Not documented",
            ],
            ["Scheduling", "Not yet", "Yes", "Campaigns only"],
            ["Marketing campaigns", "Not yet", "Yes", "Yes"],
            ["Automations", "Not yet", "No", "Yes"],
            ["Inbound email", "Not yet", "No", "Yes"],
            ["Contacts", "Not yet", "Yes", "Yes"],
            ["SMTP relay", "Not yet", "Yes", "Yes"],
            [
              "Webhooks",
              "9 events, HMAC signed, 8 retries",
              "Yes",
              "Yes",
            ],
            [
              "SDKs",
              "Node.js, plus REST",
              "TypeScript, Python, Go, PHP",
              "Node.js",
            ],
          ],
          note: VERIFIED_NOTE,
        },
      },
      {
        title: "What self-hosting takes",
        body: [
          "All three need a Postgres database, a place to run containers, and Amazon SES credentials for the actual sending, except Plunk, which does not disclose its upstream. Plan for DNS records per sending domain, SPF and DKIM at minimum, and SES production access approval from AWS, which usually takes a day.",
          "Retransmit is the smallest deployment of the three because it is the smallest product. The API, dashboard, queue worker, and SDK live in one repository, and the hosted cloud and a self-hosted instance are interchangeable behind a base URL.",
        ],
      },
      {
        title: "Which one should you pick",
        body: [],
        points: [
          "Pick Retransmit for transactional sending at volume: batches, queues, logs, and signed webhooks, with prepaid billing in the cloud.",
          "Pick useSend to replace both a transactional API and a newsletter tool with one open source app.",
          "Pick Plunk for lifecycle email: automations, segments, and inbound replies feeding one contact list.",
        ],
      },
    ],
    resources: [
      {
        href: "/compare/retransmit-vs-usesend",
        label: "Retransmit vs useSend",
        description: "The two SES-based open source stacks in detail.",
      },
      {
        href: "/compare/retransmit-vs-plunk",
        label: "Retransmit vs Plunk",
        description:
          "Transactional focus against an all-in-one marketing platform.",
      },
      {
        href: "/compare/resend-alternatives",
        label: "Best Resend alternatives in 2026",
        description:
          "The wider roundup, including proprietary options.",
      },
      DOCS_RESOURCE,
    ],
    faqs: [
      {
        q: "What is the best open source alternative to Resend or SendGrid?",
        a: "It depends on scope. Retransmit for a focused transactional API with batching and signed webhooks. useSend for transactional plus marketing campaigns and contacts. Plunk for automations, segments, and inbound email. All three self-host with Docker.",
      },
      {
        q: "Are open source email APIs really free?",
        a: "The software is. You still pay for servers, a Postgres database, and the underlying sending, typically Amazon SES at $0.10 per 1,000 emails. For most teams that lands far below managed pricing at volume.",
      },
      {
        q: "Does AGPL affect my product if I self-host one of these?",
        a: "AGPL-3.0 requires you to publish your modifications if you offer the software to others over a network. That applies to all three platforms here, Retransmit included. Internal use for your own sending is generally fine, but embedding one in a customer-facing product needs legal review.",
      },
      {
        q: "Do I need my own Amazon SES account to self-host?",
        a: "For Retransmit and useSend, yes: you bring SES credentials and request production access from AWS. That also means the sending quota and reputation belong to your AWS account, not to a vendor.",
      },
    ],
    cta: "Read the code, then send with it. Self-host for free, or start on the cloud with prepaid credits.",
  },
} as const satisfies Record<string, SeoContentPageProps>;
