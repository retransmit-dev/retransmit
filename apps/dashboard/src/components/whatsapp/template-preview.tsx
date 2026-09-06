"use client";

import { cn } from "@/lib/utils";
import { ExternalLinkIcon, PhoneIcon, ReplyIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { TemplatePreviewContent } from "./template-draft";
import { PLACEHOLDER_PATTERN } from "./template-draft";

/**
 * A received message as WhatsApp draws it: a chat background, one white
 * bubble with header, body, footer and time, then the buttons stacked under
 * it. Unfilled `{{n}}` placeholders are tinted so a missing example stands
 * out in the preview.
 */
export function TemplatePreview({
  content,
  senderName,
  className,
}: {
  content: TemplatePreviewContent;
  /** The business display name shown in the chat header. */
  senderName?: string | null;
  className?: string;
}) {
  const time = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const empty = !content.header && !content.body && !content.footer && content.buttons.length === 0;

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-[#efe7dd] dark:bg-[#0b141a]",
        className,
      )}
    >
      <div className="flex items-center gap-3 bg-[#008069] px-4 py-3 text-white dark:bg-[#1f2c34]">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
          {(senderName ?? "B").trim().charAt(0).toUpperCase() || "B"}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{senderName || "Your business"}</div>
          <div className="text-xs text-white/75">Business account</div>
        </div>
      </div>

      <div
        className="flex min-h-72 flex-col gap-2 px-4 py-5"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.05) 1px, transparent 0)",
          backgroundSize: "14px 14px",
        }}
      >
        {empty ? (
          <p className="m-auto text-center text-sm text-muted-foreground">
            Start typing a body to see the message here.
          </p>
        ) : (
          <div className="flex w-full max-w-[85%] flex-col gap-0.5 self-start">
            <div className="relative rounded-lg rounded-tl-none bg-white px-3 pt-2 pb-1.5 text-[15px] leading-snug text-[#111b21] shadow-sm dark:bg-[#202c33] dark:text-[#e9edef]">
              <span
                aria-hidden
                className="absolute -left-2 top-0 size-0 border-t-[10px] border-r-[10px] border-t-white border-r-transparent dark:border-t-[#202c33]"
              />
              {content.header && (
                <p className="mb-1 font-semibold break-words">{highlight(content.header)}</p>
              )}
              <p className="break-words whitespace-pre-wrap">{highlight(content.body)}</p>
              {content.footer && (
                <p className="mt-1 text-[13px] text-[#667781] dark:text-[#8696a0]">
                  {content.footer}
                </p>
              )}
              <p className="mt-0.5 text-right text-[11px] text-[#667781] dark:text-[#8696a0]">
                {time}
              </p>
            </div>
            {content.buttons.map((button, index) => (
              <div
                key={index}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-white py-2 text-[15px] font-medium text-[#027eb5] shadow-sm dark:bg-[#202c33] dark:text-[#53bdeb]"
              >
                {button.type === "url" ? (
                  <ExternalLinkIcon className="size-4" />
                ) : button.type === "phone_number" ? (
                  <PhoneIcon className="size-4" />
                ) : (
                  <ReplyIcon className="size-4" />
                )}
                <span className="truncate">{button.text || "Button"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Splits text so unfilled `{{n}}` tokens render tinted. */
function highlight(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    nodes.push(
      <span
        key={`${start}-${match[0]}`}
        className="rounded bg-amber-100 px-1 font-mono text-[13px] text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
      >
        {match[0]}
      </span>,
    );
    last = start + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
