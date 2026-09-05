"use client";

import { Toaster } from "@/components/ui/sonner";

import { ThemeProvider } from "./theme-provider";
import { TooltipProvider } from "./ui/tooltip";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster richColors />
    </ThemeProvider>
  );
}
