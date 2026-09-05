"use client";

import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/light";
import typescript from "react-syntax-highlighter/dist/esm/languages/hljs/typescript";
import { cn } from "@/lib/utils";

// The light entry point includes only the grammar registered here.
SyntaxHighlighter.registerLanguage("typescript", typescript);

export function SyntaxCode({
  code,
  label,
  className,
}: {
  code: string;
  label: string;
  className?: string;
}) {
  return (
    <SyntaxHighlighter
      language="typescript"
      useInlineStyles={false}
      className={cn("syntax-code", className)}
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      {code}
    </SyntaxHighlighter>
  );
}

export function WindowDots() {
  return (
    <span className="window-dots" aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}
