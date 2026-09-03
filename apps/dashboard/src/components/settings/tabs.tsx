"use client";

/**
 * The settings tab strip. A client component so the tab table, which carries
 * icon components, is imported here rather than handed across the
 * server/client boundary by the layout.
 */

import { RouteTabs } from "@/components/route-tabs";
import { settingsTabs } from "@/lib/settings-tabs";

export function SettingsTabs() {
  return <RouteTabs tabs={settingsTabs} ariaLabel="Settings sections" />;
}
