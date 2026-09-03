"use client";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { activeNavHref, type NavGroup } from "@/lib/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** `children` are extra rows appended after the group's routes. */
export function NavMain({
  group,
  children,
}: {
  group: NavGroup;
  children?: ReactNode;
}) {
  const pathname = usePathname();
  const activeHref = activeNavHref(pathname);

  return (
    <SidebarGroup>
      {group.label ? (
        <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      ) : null}
      <SidebarMenu className="group-data-[collapsible=icon]:items-center">
        {group.sections.map((section) => (
          <SidebarMenuItem key={section.href}>
            <SidebarMenuButton
              tooltip={section.title}
              isActive={section.href === activeHref}
              render={<Link href={section.href} />}
            >
              <section.icon />
              <span>{section.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        {children}
      </SidebarMenu>
    </SidebarGroup>
  );
}
