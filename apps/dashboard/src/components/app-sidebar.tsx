"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import Link from "next/link"
import {
  BanIcon,
  ChartLineIcon,
  GlobeIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  MailIcon,
  MessageCircleIcon,
  SendIcon,
  Settings2Icon,
  WebhookIcon,
} from "lucide-react"

const navMain = [
  {
    title: "Overview",
    url: "/",
    icon: <LayoutDashboardIcon />,
  },
  {
    title: "Emails",
    url: "/emails",
    icon: <MailIcon />,
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: <ChartLineIcon />,
  },
  {
    title: "Domains",
    url: "/domains",
    icon: <GlobeIcon />,
  },
  {
    title: "WhatsApp",
    url: "/whatsapp",
    icon: <MessageCircleIcon />,
  },
  {
    title: "API Keys",
    url: "/api-keys",
    icon: <KeyRoundIcon />,
  },
  {
    title: "Webhooks",
    url: "/webhooks",
    icon: <WebhookIcon />,
  },
  {
    title: "Suppressions",
    url: "/suppressions",
    icon: <BanIcon />,
  },
  {
    title: "Settings",
    url: "/settings/team",
    icon: <Settings2Icon />,
  },
]

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar?: string | null }
}) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <SendIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Retransmit</span>
                <span className="truncate text-xs">Email</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
