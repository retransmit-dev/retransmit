"use client";

import { SignOutMenuItem } from "@/components/sign-out-menu-item";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronsUpDownIcon,
  Settings2Icon,
  UsersRoundIcon,
} from "lucide-react";
import Link from "next/link";

/** The signed-in account, as the rail needs it. `image` is often null. */
export type SidebarUser = {
  name: string;
  email: string;
  image?: string | null;
};

/** Two letters for an account with no picture: initials, or the email's first. */
function initials(user: SidebarUser) {
  const letters = user.name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0))
    .slice(0, 2)
    .join("");

  return (letters || user.email.charAt(0)).toUpperCase();
}

/** A compact account menu at the foot of the sidebar. */
export function NavUser({ user }: { user: SidebarUser }) {
  const { isMobile } = useSidebar();
  const queryClient = useQueryClient();

  return (
    <SidebarMenu className="group-data-[collapsible=icon]:items-center">
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="sm"
                className="h-10 bg-card px-2 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:bg-transparent"
              />
            }
          >
            <Avatar
              size="sm"
              className="rounded-lg group-data-[collapsible=icon]:size-7!"
            >
              <AvatarImage src={user.image ?? undefined} alt={user.name} />
              <AvatarFallback>{initials(user)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-sm font-normal text-muted-foreground leading-tight group-data-[collapsible=icon]:hidden">
              {user.name || user.email}
            </span>
            <ChevronsUpDownIcon className="ml-auto text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-auto min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarImage
                      src={user.image ?? undefined}
                      alt={user.name}
                    />
                    <AvatarFallback>{initials(user)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/settings/general" />}>
                <Settings2Icon />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/settings/team" />}>
                <UsersRoundIcon />
                Team
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <SignOutMenuItem onSignedOut={() => queryClient.clear()} />
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
