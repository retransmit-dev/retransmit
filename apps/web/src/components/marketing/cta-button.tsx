import { cn } from "@/lib/utils";

/* The ledge button: one surface with the slab drawn inside it. `signal` is
   the coral primary with the bevel + coral ring cast in shadow-ledge; `quiet`
   is a flat bordered card surface. Sizes follow the shape rule: md 14px
   radius, sm 10px. */

const SIZE = {
  md: "h-12 rounded-[14px] px-5 text-base",
  sm: "h-9 rounded-[10px] px-3.5 text-sm",
} as const;

const TONE = {
  signal:
    "bg-primary text-primary-foreground shadow-ledge hover:bg-primary-emphasis hover:shadow-ledge-hover active:shadow-ledge-pressed",
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
