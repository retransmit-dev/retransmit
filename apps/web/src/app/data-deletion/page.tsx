import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal-page";
import { DATA_DELETION } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("/data-deletion");

export default function DataDeletionPage() {
  return <LegalPage doc={DATA_DELETION} />;
}
