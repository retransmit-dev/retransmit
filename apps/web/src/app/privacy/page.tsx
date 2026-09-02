import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal-page";
import { PRIVACY_POLICY } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("/privacy");

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY_POLICY} />;
}
