import { absoluteUrl, siteConfig } from "@/lib/site";

/* The `<` escape stops a crafted string from closing the script tag. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/* Site-wide graph, rendered once in the root layout. Three nodes with
   stable @ids so per-page schemas can reference them. No `offers` or
   `aggregateRating`: publishing either would be asserting something
   untrue to Google. */
export function SiteStructuredData() {
  const organizationId = absoluteUrl("/#organization");
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: siteConfig.name,
        url: siteConfig.url,
        sameAs: [siteConfig.links.github, siteConfig.links.npm],
      },
      {
        "@type": "WebSite",
        "@id": absoluteUrl("/#website"),
        name: siteConfig.name,
        url: siteConfig.url,
        inLanguage: "en",
        publisher: { "@id": organizationId },
      },
      {
        "@type": "SoftwareApplication",
        "@id": absoluteUrl("/#software"),
        name: siteConfig.name,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web browser",
        url: siteConfig.url,
        description: siteConfig.description,
        featureList: [
          "Transactional email API",
          "Transactional SMS API with per-country routing",
          "Batch sending up to 10,000 emails per request",
          "Signed webhooks with automatic retries",
          "Domain verification with SPF and DKIM",
          "Message logs with full event history",
          "Self-hostable open source stack",
        ],
        provider: { "@id": organizationId },
      },
    ],
  };
  return <JsonLd data={graph} />;
}

export function breadcrumbSchema(
  trail: readonly { name: string; href: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.href),
    })),
  };
}

/* Question and answer must stay identical to the visible FAQ copy: Google
   treats markup that differs from the page as a violation, not a mismatch. */
export function faqSchema(items: readonly { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function articleSchema({
  headline,
  description,
  href,
  datePublished,
  dateModified,
}: {
  headline: string;
  description: string;
  href: string;
  datePublished: string;
  dateModified: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    mainEntityOfPage: absoluteUrl(href),
    datePublished,
    dateModified,
    author: { "@id": absoluteUrl("/#organization") },
    publisher: { "@id": absoluteUrl("/#organization") },
  };
}

export function itemListSchema(
  items: readonly { name: string; url: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url.startsWith("/") ? absoluteUrl(item.url) : item.url,
    })),
  };
}
