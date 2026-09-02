"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { title: "General", url: "/settings/general" },
  { title: "Team", url: "/settings/team" },
] as const;

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.url}
          href={tab.url}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            pathname === tab.url
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.title}
        </Link>
      ))}
    </nav>
  );
}
