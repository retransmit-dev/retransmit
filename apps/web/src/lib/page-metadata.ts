import type { Metadata } from "next";
import type { Route } from "next";

import { getPage } from "@/lib/pages";
import { OG_IMAGE, siteConfig } from "@/lib/site";

/* One metadata object per registry page. `openGraph` and `twitter` are
   restated in full because Next replaces rather than merges them, and the
   canonical is relative so `metadataBase` resolves it. */
export function pageMetadata(href: Route): Metadata {
  const page = getPage(href);
  const carriesBrand = page.title.includes(siteConfig.name);
  const socialTitle = carriesBrand
    ? page.title
    : `${page.title} | ${siteConfig.name}`;

  return {
    title: carriesBrand ? { absolute: page.title } : page.title,
    description: page.description,
    alternates: {
      canonical: page.href,
      /* .md sibling for agents that follow rel=alternate rather than
         sending Accept: text/markdown. */
      types: { "text/markdown": `${page.href}.md` },
    },
    openGraph: {
      type: "website",
      url: page.href,
      siteName: siteConfig.name,
      locale: "en_US",
      title: socialTitle,
      description: page.description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: page.description,
      images: [OG_IMAGE.url],
    },
    ...(page.published
      ? {}
      : {
          robots: {
            index: false,
            follow: true,
            googleBot: { index: false, follow: true },
          },
        }),
  };
}
