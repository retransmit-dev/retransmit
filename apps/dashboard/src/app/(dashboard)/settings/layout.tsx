import { SettingsNav } from "@/components/settings-nav";
import type { PropsWithChildren } from "react";

export default function SettingsLayout(props: PropsWithChildren) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your organization. Domains, suppressions, and sending are
          shared with everyone in it.
        </p>
      </div>
      <SettingsNav />
      {props.children}
    </div>
  );
}
