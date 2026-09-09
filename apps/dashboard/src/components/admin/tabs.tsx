"use client";

/**
 * The operator tab strip. A client component so the tab table, which carries
 * icon components, is imported here rather than handed across the
 * server/client boundary by the layout.
 */

import { RouteTabs } from "@/components/route-tabs";
import { adminTabs } from "@/lib/admin-tabs";

const selfHostedTabs = adminTabs.filter(
  (tab) => tab.href !== "/admin/sms-rates" && tab.href !== "/admin/whatsapp-rates",
);

export function AdminTabs({ isCloud }: { isCloud: boolean }) {
  return (
    <RouteTabs
      tabs={isCloud ? adminTabs : selfHostedTabs}
      ariaLabel="Admin sections"
    />
  );
}
