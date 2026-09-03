"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useSwitchWorkspace } from "@/hooks/use-switch-workspace";
import { cn } from "@/lib/utils";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

export type WorkspaceSummary = {
  id: string;
  name: string;
};

/** The flat brand tile carrying the organization's initial. */
function WorkspaceTile({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-primary text-sm font-semibold text-primary-foreground",
        // Collapsed, a filled 36px tile is the heaviest thing in the rail and
        // pulls ahead of the mark and the nav. It steps back to 28px inside
        // the 36px row, which also lets the row's own hover state show.
        "group-data-[collapsible=icon]:size-7 group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:text-xs",
        className,
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * The card directly under the wordmark: a raised, bordered surface that lifts
 * the organization off the rail, the way the content pane does. It is the one
 * piece of chrome that says *whose* sending you are looking at, so it gets a
 * whole card rather than a line of text. With more than one organization the
 * card opens a switcher.
 */
export function NavWorkspace({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
}) {
  const { isMobile } = useSidebar();
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
    workspaces[0];
  const { switchWorkspace, switchingTo } = useSwitchWorkspace(
    activeWorkspace.id,
  );

  return (
    <SidebarMenu className="group-data-[collapsible=icon]:items-center">
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:shadow-none"
                size="lg"
              />
            }
            className="flex w-full items-center gap-3 rounded-xl bg-card p-2 text-left shadow-tray ring-0 transition-colors outline-none hover:bg-card/80 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <WorkspaceTile name={activeWorkspace.name} />
            <span className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
              <span className="text-xs text-muted-foreground">
                Organization
              </span>
              <span className="truncate text-sm font-semibold">
                {activeWorkspace.name}
              </span>
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-auto min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={8}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Organizations
              </DropdownMenuLabel>
              {workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  disabled={Boolean(switchingTo)}
                  onClick={() => switchWorkspace(workspace.id)}
                >
                  <WorkspaceTile
                    name={workspace.name}
                    className="size-6 rounded-md text-[0.6875rem]"
                  />
                  <span className="truncate">{workspace.name}</span>
                  {workspace.id === activeWorkspace.id ? (
                    <CheckIcon className="ml-auto size-4" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
