/**
 * The sections of the settings screen.
 *
 * One table, read by the tab strip in `components/settings/tabs`. Each `href`
 * is a real route under `app/(dashboard)/settings` and a row in
 * `lib/navigation`, so the sidebar, the page header and this strip agree on
 * names. `Route` typing means a deleted page fails `check-types` instead of
 * shipping a tab that 404s.
 */

import type { RouteTab } from "@/components/route-tabs";
import { Building2Icon, UsersRoundIcon } from "lucide-react";

export const settingsTabs = [
  {
    href: "/settings/general",
    icon: Building2Icon,
    label: "General",
    tone: "sky",
  },
  {
    href: "/settings/team",
    icon: UsersRoundIcon,
    label: "Team",
    tone: "emerald",
  },
] as const satisfies ReadonlyArray<RouteTab>;
