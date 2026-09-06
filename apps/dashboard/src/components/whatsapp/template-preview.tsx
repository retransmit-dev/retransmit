"use client";

import { cn } from "@/lib/utils";
import {
  ArrowLeftIcon,
  BadgeCheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  ImageIcon,
  ListIcon,
  MapPinIcon,
  MoreVerticalIcon,
  PhoneIcon,
  PlayIcon,
  VideoIcon,
} from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";

import type { TemplatePreviewContent } from "./template-draft";

/**
 * A received template message drawn the way the WhatsApp Android app draws
 * it: the green chat header, the doodled wallpaper, a "Today" pill and the
 * business notice, then one white bubble with media or text header, body,
 * footer and time. Call-to-action buttons sit inside the bubble under a
 * divider; quick replies sit beneath it as their own bubbles. More than
 * three buttons collapse to "See all options" like the real client.
 * Unfilled `{{n}}` placeholders are tinted so a missing example stands out.
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
  const empty =
    !content.header &&
    !content.headerMedia &&
    !content.body &&
    !content.footer &&
    content.buttons.length === 0;
  const name = senderName?.trim() || "Your business";

  const collapsed = content.buttons.length > 3;
  const inline = collapsed
    ? content.buttons.slice(0, 2)
    : content.buttons.filter((button) => button.type !== "quick_reply");
  const quickReplies = collapsed
    ? []
    : content.buttons.filter((button) => button.type === "quick_reply");

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-[#efeae2] font-[system-ui,-apple-system,'Segoe_UI',Roboto,'Helvetica_Neue',sans-serif] dark:bg-[#0b141a]",
        className,
      )}
    >
      <div className="flex items-center gap-2 bg-[#008069] py-2 pr-2 pl-2 text-white dark:bg-[#1f2c34]">
        <ArrowLeftIcon className="size-5 shrink-0" strokeWidth={2.25} />
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#dfe5e7] text-sm font-semibold text-[#54656f]">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1">
            <span className="truncate text-[15.5px] font-medium">{name}</span>
            <BadgeCheckIcon className="size-4 shrink-0 fill-[#25d366] text-[#008069] dark:text-[#1f2c34]" />
          </div>
          <div className="text-[12.5px] text-white/80">Business account</div>
        </div>
        <VideoIcon className="size-5 shrink-0" />
        <PhoneIcon className="ml-3 size-[18px] shrink-0" />
        <MoreVerticalIcon className="ml-2 size-5 shrink-0" />
      </div>

      <div
        className="flex min-h-80 flex-col gap-2 bg-[image:var(--doodle)] px-3 pt-2 pb-5 [--doodle:var(--doodle-light)] dark:[--doodle:var(--doodle-dark)]"
        style={
          {
            "--doodle-light": `url("${DOODLE_LIGHT}")`,
            "--doodle-dark": `url("${DOODLE_DARK}")`,
            backgroundSize: "180px 180px",
          } as CSSProperties
        }
      >
        <div className="mx-auto rounded-[7.5px] bg-white px-3 py-1 text-[12.5px] text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] dark:bg-[#182229] dark:text-[#8696a0]">
          Today
        </div>
        <div className="mx-auto max-w-[92%] rounded-[7.5px] bg-[#ffeecd] px-3 py-1.5 text-center text-[12.5px] leading-[17px] text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] dark:bg-[#182229] dark:text-[#ffd279]">
          This business works with other companies to manage this chat. Tap to learn more.
        </div>

        {empty ? (
          <p className="m-auto text-center text-sm text-[#54656f] dark:text-[#8696a0]">
            Start typing a body to see the message here.
          </p>
        ) : (
          <div className="mt-2 flex w-full max-w-[88%] flex-col gap-[3px] self-start">
            <div className="relative ml-2 rounded-[7.5px] rounded-tl-none bg-white text-[14.2px] leading-[19px] text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] dark:bg-[#202c33] dark:text-[#e9edef]">
              <Tail />
              {content.headerMedia && (
                <div className="p-[3px] pb-0">
                  <MediaHeader media={content.headerMedia} />
                </div>
              )}
              <div className={cn("px-[9px] pt-[6px] pb-[8px]", content.headerMedia && "pt-[5px]")}>
                {!content.headerMedia && content.header && (
                  <p className="mb-[3px] font-bold break-words">{richText(content.header)}</p>
                )}
                <p className="break-words whitespace-pre-wrap">
                  {richText(content.body)}
                  {!content.footer && <Time value={time} />}
                </p>
                {content.footer && (
                  <p className="mt-[3px] text-[13px] leading-[17px] text-[#8696a0] break-words">
                    {content.footer}
                    <Time value={time} />
                  </p>
                )}
              </div>
              {inline.map((button, index) => (
                <InlineButton key={index} type={button.type}>
                  {button.text || "Button"}
                </InlineButton>
              ))}
              {collapsed && <InlineButton type="list">See all options</InlineButton>}
            </div>

            {quickReplies.length > 0 && (
              <div className="ml-2 grid grid-cols-2 gap-[3px]">
                {quickReplies.map((button, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex min-h-[38px] items-center justify-center rounded-[7.5px] bg-white px-3 py-2 text-center text-[14.2px] leading-[19px] font-medium text-[#027eb5] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] dark:bg-[#202c33] dark:text-[#53bdeb]",
                      quickReplies.length % 2 === 1 &&
                        index === quickReplies.length - 1 &&
                        "col-span-2",
                    )}
                  >
                    <span className="line-clamp-2">{button.text || "Button"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The bubble's tail, as WhatsApp Web draws it. */
function Tail() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 8 13"
      width="8"
      height="13"
      className="absolute top-0 -left-2 text-white dark:text-[#202c33]"
    >
      <path opacity=".13" d="M1.533 3.568 8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z" />
      <path fill="currentColor" d="M1.533 2.568 8 11.193V0H2.812C1.042 0 .474 1.156 1.533 2.568z" />
    </svg>
  );
}

/** The message time, floated after the last line the way the client does it. */
function Time({ value }: { value: string }) {
  return (
    <span className="relative top-[4px] float-right ml-2 -mb-[2px] text-[11px] leading-[15px] whitespace-nowrap text-[#667781] dark:text-[#8696a0]">
      {value}
    </span>
  );
}

function InlineButton({
  type,
  children,
}: {
  type: "url" | "phone_number" | "quick_reply" | "list";
  children: ReactNode;
}) {
  const Icon =
    type === "url"
      ? ExternalLinkIcon
      : type === "phone_number"
        ? PhoneIcon
        : type === "list"
          ? ListIcon
          : null;
  return (
    <div className="flex min-h-[44px] items-center justify-center gap-1.5 border-t border-[#e9edef] px-3 text-[14.2px] font-medium text-[#027eb5] dark:border-white/10 dark:text-[#53bdeb]">
      {Icon && <Icon className="size-[18px] shrink-0" />}
      <span className="truncate">{children}</span>
    </div>
  );
}

function MediaHeader({ media }: { media: NonNullable<TemplatePreviewContent["headerMedia"]> }) {
  const [broken, setBroken] = useState(false);

  switch (media.format) {
    case "image":
      return media.url && !broken ? (
        <img
          src={media.url}
          alt=""
          onError={() => setBroken(true)}
          className="block max-h-56 w-full rounded-[6px] object-cover"
        />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-[6px] bg-[#dfe5e7] dark:bg-[#2a3942]">
          <ImageIcon className="size-10 text-[#8696a0]" strokeWidth={1.5} />
        </div>
      );
    case "video":
      return (
        <div className="flex h-40 items-center justify-center rounded-[6px] bg-[#1f2c34]">
          <div className="flex size-12 items-center justify-center rounded-full bg-black/50">
            <PlayIcon className="ml-0.5 size-6 fill-white text-white" />
          </div>
        </div>
      );
    case "document":
      return (
        <div className="flex items-center gap-3 rounded-[6px] bg-[#f5f6f6] px-3 py-3 dark:bg-[#1d282f]">
          <FileTextIcon className="size-8 shrink-0 text-[#e5252a]" strokeWidth={1.5} />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[14.2px] text-[#111b21] dark:text-[#e9edef]">
              Document.pdf
            </div>
            <div className="text-[12px] text-[#8696a0]">PDF</div>
          </div>
        </div>
      );
    case "location":
      return (
        <div
          className="flex h-32 items-center justify-center rounded-[6px] bg-[#d9e3d6] dark:bg-[#1d282f]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          <MapPinIcon className="size-9 fill-[#ea4335] text-white" strokeWidth={1.5} />
        </div>
      );
  }
}

const TOKEN_PATTERN =
  /\{\{\s*\d+\s*\}\}|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~|```([^`]+)```/g;

/**
 * Renders WhatsApp's inline formatting (`*bold*`, `_italic_`, `~strike~`,
 * ```` ```mono``` ````) and tints unfilled `{{n}}` tokens.
 */
function richText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    const key = `${start}-${match[0]}`;
    const [token, bold, italic, strike, mono] = match;
    if (bold) nodes.push(<strong key={key}>{bold}</strong>);
    else if (italic) nodes.push(<em key={key}>{italic}</em>);
    else if (strike) nodes.push(<s key={key}>{strike}</s>);
    else if (mono) nodes.push(<code key={key} className="font-mono text-[13px]">{mono}</code>);
    else
      nodes.push(
        <span
          key={key}
          className="rounded bg-amber-100 px-1 font-mono text-[13px] text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
        >
          {token}
        </span>,
      );
    last = start + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** WhatsApp's wallpaper: faint line-art doodles tiled over the chat colour. */
function doodle(stroke: string, opacity: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180' fill='none' stroke='${stroke}' stroke-opacity='${opacity}' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'><circle cx='22' cy='26' r='7'/><path d='M64 14l5 9h-10z'/><path d='M112 22q7-11 14 0t14 0'/><path d='M158 40h12m-6-6v12'/><path d='M34 84l9 9m0-9l-9 9'/><rect x='72' y='66' width='13' height='13' rx='2' transform='rotate(18 78 72)'/><path d='M126 76c4-9 12-9 16 0'/><circle cx='160' cy='96' r='4'/><path d='M18 128c6-9 13 9 19 0'/><path d='M60 140a8 8 0 1 0 16 0'/><path d='M104 122l7-12 7 12z'/><path d='M140 150h16'/><path d='M92 166q5-6 10 0'/><circle cx='40' cy='166' r='3'/><path d='M150 128a6 6 0 0 1 12 0'/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const DOODLE_LIGHT = doodle("#3b4a54", 0.16);
const DOODLE_DARK = doodle("#e9edef", 0.07);
