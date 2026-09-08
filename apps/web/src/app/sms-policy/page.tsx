import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal-page";
import { SMS_POLICY } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("/sms-policy");

export default function SmsPolicyPage() {
  return <LegalPage doc={SMS_POLICY} />;
}
