import { cn } from "@/lib/utils";
import Image from "next/image";

/**
 * The wordmark, as apps/web draws it: the name in the heading face with the
 * coral full stop. Text rather than an image so it follows the theme.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-heading text-lg font-extrabold tracking-tight leading-none",
        className,
      )}
    >
      retransmit<span className="text-primary">.</span>
    </span>
  );
}

/** The square product icon, for the collapsed rail and the mobile bar. */
export function BrandIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/images/icon.png"
      alt=""
      width={64}
      height={64}
      priority
      className={cn("rounded-md object-contain", className)}
    />
  );
}
