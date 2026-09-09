"use client";

/**
 * The settings tab strip. A client component so the tab table, which carries
 * icon components, is imported here rather than handed across the
 * server/client boundary by the layout.
 */

import { RouteTabs } from "@/components/route-tabs";
import { settingsTabs } from "@/lib/settings-tabs";

const selfHostedTabs = settingsTabs.filter((tab) => tab.href !== "/settings/billing");

export function SettingsTabs({ isCloud }: { isCloud: boolean }) {
  return (
    <RouteTabs
      tabs={isCloud ? settingsTabs : selfHostedTabs}
      ariaLabel="Settings sections"
    />
  );
}
