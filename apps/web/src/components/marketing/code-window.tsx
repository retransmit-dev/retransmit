"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export type CodeTab = {
  label: string;
  code: React.ReactNode;
};

/* An editor window: macOS traffic lights, filename tabs, mono body. The
   hairline is the card ring so it matches every other surface. */
export function CodeWindow({
  tabs,
  className,
}: {
  tabs: CodeTab[];
  className?: string;
}) {
  const [active, setActive] = useState(0);
  const current = tabs[active] ?? tabs[0];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1rem] bg-card text-left shadow-card",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b-[0.5px] border-foreground/5 px-4 py-2.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex gap-1 font-mono text-xs">
          {tabs.map((tab, i) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors duration-100 ease-haptic outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                i === active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-foreground/90">
        {current?.code}
      </pre>
    </div>
  );
}
