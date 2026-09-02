import type {
  ComparisonTable,
  SeoContentPageProps,
  TableCell,
} from "@/components/marketing/seo-content-page";
import { COMPARE_CONTENT } from "@/lib/compare-content";
import { LEGAL_DOCS, type LegalDoc } from "@/lib/legal-content";
import { getPage, publishedPages } from "@/lib/pages";
import { absoluteUrl, siteConfig } from "@/lib/site";

/* Markdown representations of every indexable page, served to agents via
   `Accept: text/markdown` negotiation and `.md` sibling URLs. Rendered
   from the same data the HTML pages read (SITE_PAGES, COMPARE_CONTENT),
   so the two representations cannot drift apart. */

function cellText(cell: TableCell): string {
  const text =
    typeof cell === "string" ? cell : `[${cell.label}](${cell.href})`;
  return text.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function tableMarkdown(table: ComparisonTable): string {
  const lines = [
    `| ${table.columns.map((column) => cellText(column)).join(" | ")} |`,
    `| ${table.columns.map(() => "---").join(" | ")} |`,
    ...table.rows.map(
      (row) => `| ${row.map((cell) => cellText(cell)).join(" | ")} |`,
    ),
  ];
  if (table.note) lines.push("", `_${table.note}_`);
  return lines.join("\n");
}

/* Every document ends with its canonical URL and the machine-readable
   entry points, so an agent that lands anywhere can find everything. */
function footer(canonicalPath: string): string {
  return [
    "---",
    "",
    `Canonical: ${absoluteUrl(canonicalPath)}`,
    "",
    `Agent resources: [llms.txt](${absoluteUrl("/llms.txt")}) | ` +
      `[sitemap](${absoluteUrl("/sitemap.xml")}) | ` +
      `[OpenAPI spec](${absoluteUrl("/openapi.json")}) | ` +
      `[docs](${siteConfig.links.docs})`,
  ].join("\n");
}

export function seoPageMarkdown(props: SeoContentPageProps): string {
  const parts: string[] = [`# ${props.title}`, "", props.lead, ""];

  if (props.editorial) {
    parts.push(
      `> By the ${siteConfig.name} team. Last updated ${props.editorial.dateModifiedLabel}. ${props.editorial.disclosure}`,
      "",
    );
  }

  parts.push(props.summary, "");

  for (const section of props.sections) {
    parts.push(`## ${section.title}`, "");
    if (section.subtitle) parts.push(`_${section.subtitle}_`, "");
    for (const paragraph of section.body) parts.push(paragraph, "");
    if (section.table) parts.push(tableMarkdown(section.table), "");
    if (section.points?.length) {
      parts.push(...section.points.map((point) => `- ${point}`), "");
    }
    if (section.sources?.length) {
      parts.push(
        `Sources: ${section.sources
          .map((source) => `[${source.label}](${source.href})`)
          .join(", ")}`,
        "",
      );
    }
  }

  parts.push("## Related resources", "");
  for (const resource of props.resources) {
    const href = resource.href.startsWith("/")
      ? absoluteUrl(resource.href)
      : resource.href;
    parts.push(`- [${resource.label}](${href}): ${resource.description}`);
  }
  parts.push("");

  parts.push("## Questions people ask", "");
  for (const faq of props.faqs) {
    parts.push(`### ${faq.q}`, "", faq.a, "");
  }

  if (props.cta) parts.push(props.cta, "");

  parts.push(footer(props.href));
  return parts.join("\n");
}

/* Mirrors the copy in src/app/page.tsx. Update both together. */
export function homeMarkdown(): string {
  return [
    `# ${siteConfig.name}: ${siteConfig.tagline.toLowerCase()}`,
    "",
    "One API. Every message. Send transactional email and SMS from one API and one prepaid balance. WhatsApp is next.",
    "",
    siteConfig.description,
    "",
    "## Channels",
    "",
    "Every channel shares the same key, SDK, webhooks, and balance. New ones arrive as an SDK update, not another account.",
    "",
    "- Email: live. Transactional email with domain verification, batch sending, and full event history.",
    "- SMS: live. Text messages routed per country to the cheapest provider, with delivery receipts.",
    "- WhatsApp: coming soon. Template and session messages through the same API and balance.",
    "- OTP: planned. One-time codes with generation, delivery, and verification handled for you.",
    "",
    "## Email",
    "",
    "One request, email delivered. Verify a domain, grab an API key, and send your first email in under five minutes.",
    "",
    "- Every SDK call returns `{ data, error }`. No thrown surprises.",
    "- Sends return a `202` in milliseconds and are delivered by a rate-aware worker.",
    `- Zero-dependency SDK on npm as [retransmit.dev](${siteConfig.links.npm}), or plain REST from any language.`,
    "",
    "## Batch",
    "",
    "Send one, or send ten thousand. One request queues up to 10,000 emails; poll the batch for per-status counts while the worker drains it at your provider's rate. Every message in the batch still gets its own id, log entry, and webhook events.",
    "",
    "## SMS",
    "",
    "Text the same way you email: same SDK, same response shape, same balance. The destination country is detected from the number and each message is routed to the cheapest configured provider. Set your own sender id, up to 11 characters. Delivery receipts come back as `sms.delivered` webhooks and in the message's event history.",
    "",
    "## Webhooks",
    "",
    "Email events (sent, delivered, delivery_delayed, opened, clicked, bounced, complained, rejected, failed) and SMS events (sent, delivered, undelivered, failed), signed with HMAC-SHA256 over `timestamp.body` and retried up to 8 times with exponential backoff.",
    "",
    "## Deliverability",
    "",
    "- Domain verification with SPF and DKIM; the dashboard gives you exact records to copy.",
    "- Hard bounces and complaints are caught automatically to protect sender reputation.",
    "- Every send is queued, rate aware, and retried with exponential backoff.",
    "- Fetch any message by id and read its full event history.",
    "- Scoped bearer API keys you create and revoke from the dashboard.",
    "",
    "## Open source and self-hosting",
    "",
    `The API, dashboard, queue, and SDK live in [one repository](${siteConfig.links.github}) under AGPL-3.0 (the SDK is MIT). Self-hosting is free forever with every feature, using your own provider credentials. Moving between cloud and self-hosted is a base URL change.`,
    "",
    "## Pricing",
    "",
    "- Self-hosted: free forever, every feature, no license key, no phone-home.",
    "- Cloud: prepaid credits, no subscriptions or seats. Fund the balance in your local currency, including bank transfer and mobile money.",
    "",
    "## Get started",
    "",
    `- [Quickstart](${siteConfig.links.quickstart})`,
    `- [Documentation](${siteConfig.links.docs})`,
    `- [API reference](${siteConfig.links.apiReference})`,
    `- [Compare email APIs](${absoluteUrl("/compare")})`,
    "",
    footer("/"),
  ].join("\n");
}

export function compareHubMarkdown(): string {
  const hub = getPage("/compare");
  const pages = publishedPages().filter(
    (page) => page.group === "compare" && page.href !== "/compare",
  );
  return [
    `# ${hub.title}`,
    "",
    hub.description,
    "",
    ...pages.map(
      (page) =>
        `- [${page.title}](${absoluteUrl(page.href)}): ${page.description}`,
    ),
    "",
    footer("/compare"),
  ].join("\n");
}

export function legalMarkdown(doc: LegalDoc): string {
  const parts: string[] = [
    `# ${doc.title}`,
    "",
    `_Last updated ${doc.updatedLabel}._`,
    "",
    doc.intro,
    "",
  ];
  for (const section of doc.sections) {
    parts.push(`## ${section.title}`, "");
    for (const paragraph of section.body) parts.push(paragraph, "");
    if (section.points?.length) {
      parts.push(...section.points.map((point) => `- ${point}`), "");
    }
  }
  parts.push(footer(doc.href));
  return parts.join("\n");
}

export function notFoundMarkdown(pathname: string): string {
  return [
    "# 404: page not found",
    "",
    `There is no page at \`${pathname}\` on ${siteConfig.url}.`,
    "",
    "Where to look next:",
    "",
    `- [Home](${siteConfig.url}): product overview and pricing model`,
    ...publishedPages().map(
      (page) => `- [${page.title}](${absoluteUrl(page.href)})`,
    ),
    `- [Documentation](${siteConfig.links.docs})`,
    `- [Sitemap](${absoluteUrl("/sitemap.xml")})`,
    `- [llms.txt](${absoluteUrl("/llms.txt")})`,
    `- [OpenAPI spec](${absoluteUrl("/openapi.json")})`,
    "",
    "Every page here also serves Markdown: request it with `Accept: text/markdown`, or append `.md` to the path.",
  ].join("\n");
}

const RENDERERS = new Map<string, () => string>([
  ["/", homeMarkdown],
  ["/compare", compareHubMarkdown],
  ...Object.values(COMPARE_CONTENT).map(
    (content) =>
      [content.href as string, () => seoPageMarkdown(content)] as const,
  ),
  ...LEGAL_DOCS.map(
    (doc) => [doc.href as string, () => legalMarkdown(doc)] as const,
  ),
]);

/** Paths that have a Markdown representation. */
export function hasMarkdown(pathname: string): boolean {
  return RENDERERS.has(pathname);
}

/** The Markdown document for a path, or null when none exists. */
export function markdownForPath(pathname: string): string | null {
  const render = RENDERERS.get(pathname);
  return render ? render() : null;
}
