import { cn } from "@/lib/utils";

/* Hairlines are 1px box-shadow rings, never borders: a ring paints outside
   the box, costs no layout, and doesn't fight the radius at tight corners.
   A tray is the outer tinted shell holding a Card inset by 6px. */

export function CardTray({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-[1.3rem] bg-tray p-1.5 shadow-tray", className)}>
      {children}
    </div>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-[1rem] bg-card shadow-card", className)}>
      {children}
    </div>
  );
}
