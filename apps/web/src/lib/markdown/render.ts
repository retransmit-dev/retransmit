import type {
  ComparisonTable,
  SeoContentPageProps,
  TableCell,
} from "@/components/marketing/seo-content-page";
import { COMPARE_CONTENT } from "@/lib/compare-content";
import { LEGAL_DOCS, type LegalDoc } from "@/lib/legal-content";
import { getPage, publishedPages } from "@/lib/pages";
import { PRODUCTS, productHref, type Product } from "@/lib/products";
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

/* Product descriptions are shared with the HTML pages and navigation. */
export function homeMarkdown(): string {
  return [
    `# ${siteConfig.name}: Email, SMS & WhatsApp. One API.`,
    "",
    "Send messages from your app with one API key and one Node.js SDK.",
    "",
    "## Channels",
    "",
    ...PRODUCTS.map(
      (product) =>
        `- [${product.name}](${absoluteUrl(productHref(product))}): ${product.summary}`,
    ),
    "",
    "## Infrastructure",
    "",
    "- One API key and typed SDK across your channels.",
    "- Queued sending with automatic retries.",
    "- Signed webhooks for message updates.",
    "",
    "## Migrating from Resend",
    "",
    "- The send call has the same shape and returns the same `{ data, error }` result. Replace `new Resend(key)` with `new Retransmit(key)` from the `retransmit.dev` package.",
    "- The API takes `html` and `text`, not a `react` prop. Render React Email templates first: `html: await render(<WelcomeEmail />)` with `render` from `@react-email/components`. Pass `{ plainText: true }` for the text body.",
    "- Verify your domain with the SPF and DKIM records we give you, then re-create your webhook endpoints.",
    `- [Retransmit vs Resend](${absoluteUrl("/compare/retransmit-vs-resend")})`,
    "",
    "## Deployment",
    "",
    "- Retransmit Cloud: pay for what you send. Top up with bank transfer or mobile money. No subscription or seat fees.",
    `- [Self-hosted](${siteConfig.links.github}): free to self-host. Your servers, providers, and data.`,
    "",
    "## Send your first message",
    "",
    `- [Get your API key](${siteConfig.links.app})`,
    `- [Quickstart](${siteConfig.links.quickstart})`,
    `- [Documentation](${siteConfig.links.docs})`,
    "",
    footer("/"),
  ].join("\n");
}

export function productMarkdown(product: Product): string {
  const parts = [
    `# ${product.name}: ${product.headline}`,
    "",
    ...(product.status === "coming-soon" ? ["Coming soon.", ""] : []),
    product.description,
    "",
    ...product.useCases.map((useCase) => `- ${useCase}`),
    "",
  ];
  for (const feature of product.features) {
    parts.push(`## ${feature.title}`, "", feature.description, "");
  }
  if (product.example) {
    parts.push(
      "## Example",
      "",
      "```typescript",
      `const { data, error } = await retransmit.${product.example.method}({`,
    );
    for (const field of product.example.fields)
      parts.push(`  ${field.name}: ${JSON.stringify(field.value)},`);
    parts.push("});", "```", "");
    if (product.example.note) parts.push(product.example.note, "");
  }
  parts.push(
    `[API documentation](${siteConfig.links.apiReference})`,
    "",
    footer(productHref(product)),
  );
  return parts.join("\n");
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
  ...PRODUCTS.map(
    (product) =>
      [productHref(product), () => productMarkdown(product)] as const,
  ),
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
