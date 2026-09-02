import type { MetadataRoute } from "next";

import { publishedPages } from "@/lib/pages";
import { absoluteUrl, siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: siteConfig.url,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...publishedPages().map((page) => ({
      url: absoluteUrl(page.href),
      lastModified: now,
      changeFrequency: page.changeFrequency ?? "monthly",
      priority: page.priority ?? 0.6,
    })),
  ];
}
