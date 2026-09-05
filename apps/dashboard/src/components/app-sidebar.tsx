"use client";

import type * as React from "react";

import { BrandIcon, BrandMark } from "@/components/brand-mark";
import { ModeToggle } from "@/components/mode-toggle";
import { NavMain } from "@/components/nav-main";
import { NavUser, type SidebarUser } from "@/components/nav-user";
import {
  NavWorkspace,
  type WorkspaceSummary,
} from "@/components/nav-workspace";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { visibleNavGroups } from "@/lib/navigation";
import { BookOpenIcon } from "lucide-react";
import Link from "next/link";

const DOCS_URL = "https://docs.retransmit.dev";

export function AppSidebar({
  user,
  workspaces,
  activeWorkspaceId,
  isAdmin = false,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: SidebarUser;
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
  /** Adds the operator-only rows. Decided on the server from the session. */
  isAdmin?: boolean;
}) {
  const { open } = useSidebar();
  const groups = visibleNavGroups(isAdmin);
  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
          {open ? (
            <>
              <Link
                href="/"
                className="flex items-center gap-2 rounded-md px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <BrandMark />
              </Link>

              <SidebarTrigger className="text-sidebar-foreground/60 hover:text-sidebar-foreground" />
            </>
          ) : (
            /*
             * Collapsed, the mark doubles as the way back out: hovering (or
             * tabbing to) it swaps the icon for the toggle in place. The group
             * is named so the swap answers to this square alone — the rail's
             * own wrapper is a bare `group`, and an unnamed `group-hover:`
             * here would fire anywhere over the rail.
             */
            <div className="group/brand relative flex size-9 items-center justify-center">
              <BrandIcon className="size-5" />

              <SidebarTrigger className="absolute inset-0 size-9 text-sidebar-foreground/60 opacity-0 transition-opacity group-hover/brand:opacity-100 hover:text-sidebar-foreground focus-visible:opacity-100 [&_svg]:size-5!" />
            </div>
          )}
        </div>
        <NavWorkspace
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
        />
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <NavMain key={group.label ?? group.sections[0].href} group={group} />
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-1">
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <BookOpenIcon className="size-3.5 group-data-[collapsible=icon]:size-5" />
            <span className="group-data-[collapsible=icon]:hidden">Docs</span>
          </a>
          <ModeToggle
            variant="ghost"
            size="icon-sm"
            className="group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:[&_svg]:size-5!"
          />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
