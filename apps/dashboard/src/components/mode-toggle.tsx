"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import type { ComponentProps } from "react";

type ModeToggleProps = {
  className?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
};

export function ModeToggle({
  className,
  variant = "outline",
  size = "icon",
}: ModeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      aria-label="Toggle theme"
      className={cn("relative rounded-full", className)}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      size={size}
      type="button"
      variant={variant}
    >
      <Sun className="rotate-0 scale-100 transition-[transform,opacity] duration-160 ease-out motion-reduce:transition-none dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute rotate-90 scale-0 transition-[transform,opacity] duration-160 ease-out motion-reduce:transition-none dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
