"use client"

import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const TITLES: Record<string, string> = {
  "/": "Overview",
  "/emails": "Emails",
  "/domains": "Domains",
  "/api-keys": "API Keys",
  "/webhooks": "Webhooks",
}

export function PageBreadcrumb() {
  const pathname = usePathname()
  const base = `/${pathname.split("/")[1] ?? ""}`
  const title = TITLES[base] ?? TITLES[pathname] ?? "Overview"

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink href="/">Retransmit</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />
        <BreadcrumbItem>
          <BreadcrumbPage>{title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
