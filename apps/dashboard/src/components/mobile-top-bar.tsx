"use client";

import { BrandMark } from "@/components/brand-mark";
import { SidebarTrigger } from "@/components/ui/sidebar";
import Link from "next/link";

/**
 * The only way into the menu on a phone.
 *
 * Below `md` the sidebar is an off-canvas sheet, and the collapse control it
 * carries is inside that sheet, so nothing on screen can open it. This bar
 * sits above the page on small screens with the trigger and the brand mark;
 * on wider screens the rail is always visible and the bar disappears.
 */
export function MobileTopBar() {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3 md:hidden">
      <SidebarTrigger className="-ml-1" />
      <Link
        href="/"
        className="flex items-center rounded-md px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BrandMark />
      </Link>
    </div>
  );
}
