/**
 * The sections of the operator screen.
 *
 * Same shape as `settings-tabs`: one table read by the tab strip in
 * `components/admin/tabs`, with each `href` a real route under
 * `app/(dashboard)/admin` and a row in `lib/navigation`, so the sidebar, the
 * page header and this strip agree on names. `Route` typing means a deleted
 * page fails `check-types` instead of shipping a tab that 404s.
 *
 * These were one long page until it grew four blocks with tables in them.
 * Splitting them into routes means a rate edit does not sit below a users
 * table that had to load first, and "the SMS rate card" is a link.
 */

import type { RouteTab } from "@/components/route-tabs";
import {
  BadgeCheckIcon,
  BanknoteIcon,
  CoinsIcon,
  RouteIcon,
  UsersRoundIcon,
} from "lucide-react";

export const adminTabs = [
  {
    href: "/admin/senders",
    icon: BadgeCheckIcon,
    label: "Sender IDs",
    tone: "emerald",
  },
  {
    href: "/admin/sms-routing",
    icon: RouteIcon,
    label: "SMS routing",
    tone: "sky",
  },
  {
    href: "/admin/sms-rates",
    icon: BanknoteIcon,
    label: "SMS rates",
    tone: "amber",
  },
  {
    href: "/admin/whatsapp-rates",
    icon: CoinsIcon,
    label: "WhatsApp rates",
    tone: "cyan",
  },
  {
    href: "/admin/users",
    icon: UsersRoundIcon,
    label: "Users",
    tone: "violet",
  },
] as const satisfies ReadonlyArray<RouteTab>;
