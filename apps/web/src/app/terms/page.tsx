import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal-page";
import { TERMS_OF_SERVICE } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("/terms");

export default function TermsPage() {
  return <LegalPage doc={TERMS_OF_SERVICE} />;
}
