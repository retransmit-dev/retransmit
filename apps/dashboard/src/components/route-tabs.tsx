"use client";

/**
 * A tab strip whose tabs are routes.
 *
 * Every tab is a real page, so a link straight into `/billing/invoices` or
 * `/settings/team` lands where it should and the back button behaves; the
 * strip is navigation drawn as tabs, not client-side state. Billing and
 * settings both render one of these from their own table of tabs; the company
 * screen has its own strip because it also shows a count beside each label.
 *
 * The shortest href is the section index. It only lights on an exact match;
 * the others stay lit for anything underneath them.
 */

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Tone, tones } from "@/lib/tone";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type RouteTab = {
  href: Route;
  icon: LucideIcon;
  label: string;
  tone: Tone;
};

export function RouteTabs({
  ariaLabel,
  tabs,
}: {
  ariaLabel: string;
  tabs: ReadonlyArray<RouteTab>;
}) {
  const pathname = usePathname();
  const indexHref = tabs.reduce((shortest, tab) =>
    tab.href.length < shortest.href.length ? tab : shortest,
  ).href;

  const activeTab = tabs.find((tab) =>
    tab.href === indexHref
      ? pathname === tab.href
      : pathname === tab.href || pathname.startsWith(`${tab.href}/`),
  );

  return (
    <Tabs value={activeTab?.href ?? null}>
      <div className="overflow-x-auto border-b">
        <TabsList
          variant="line"
          aria-label={ariaLabel}
          className="min-w-max gap-4 p-0"
        >
          {tabs.map((tab) => {
            const tone = tones[tab.tone];

            return (
              <TabsTrigger
                key={tab.href}
                value={tab.href}
                className="group/tab gap-2 px-1.5 pb-3"
                nativeButton={false}
                render={<Link href={tab.href} />}
              >
                <tab.icon
                  className={cn(
                    "size-4 opacity-70 transition-opacity group-hover/tab:opacity-100 group-data-active/tab:opacity-100",
                    tone.icon,
                  )}
                />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>
    </Tabs>
  );
}
