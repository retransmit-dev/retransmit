"use client";

/**
 * The operator tab strip. A client component so the tab table, which carries
 * icon components, is imported here rather than handed across the
 * server/client boundary by the layout.
 */

import { RouteTabs } from "@/components/route-tabs";
import { adminTabs } from "@/lib/admin-tabs";

export function AdminTabs() {
  return <RouteTabs tabs={adminTabs} ariaLabel="Admin sections" />;
}
