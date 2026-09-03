import { PageHeader, PageShell } from "@/components/page-shell";
import { SettingsTabs } from "@/components/settings/tabs";
import type { PropsWithChildren } from "react";

/**
 * The settings screen is one page with two tabs: General and Team. This
 * layout owns the strip that switches between them; each tab's page owns its
 * own data.
 */
export default function SettingsLayout({ children }: PropsWithChildren) {
  return (
    <PageShell>
      <PageHeader href="/settings" className="gap-4">
        <SettingsTabs />
      </PageHeader>

      {children}
    </PageShell>
  );
}
