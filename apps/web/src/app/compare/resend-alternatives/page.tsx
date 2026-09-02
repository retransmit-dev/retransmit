import type { Metadata } from "next";

import { SeoContentPage } from "@/components/marketing/seo-content-page";
import { COMPARE_CONTENT } from "@/lib/compare-content";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("/compare/resend-alternatives");

export default function Page() {
  return <SeoContentPage {...COMPARE_CONTENT.resendAlternatives} />;
}
