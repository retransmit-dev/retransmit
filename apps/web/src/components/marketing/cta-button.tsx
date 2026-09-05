import { cn } from "@/lib/utils";

/* Shared marketing links: solid primary action or a bordered secondary. */

const SIZE = {
  md: "h-11 rounded-md px-4 text-sm",
  sm: "h-9 rounded-md px-3.5 text-sm",
} as const;

const TONE = {
  signal: "bg-foreground text-background hover:bg-foreground/85",
  quiet: "border border-border bg-card text-foreground hover:bg-muted",
} as const;

export function CtaButton({
  href,
  tone = "signal",
  size = "md",
  external = false,
  goal,
  goalPlacement,
  className,
  children,
}: {
  href: string;
  tone?: keyof typeof TONE;
  size?: keyof typeof SIZE;
  external?: boolean;
  goal?: string;
  goalPlacement?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      data-wa-goal={goal}
      data-wa-goal-placement={goalPlacement}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 font-medium transition duration-100 ease-haptic outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-[0.5px]",
        SIZE[size],
        TONE[tone],
        className,
      )}
    >
      {children}
    </a>
  );
}
