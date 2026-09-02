import { cn } from "@/lib/utils";

export function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-16 py-14 sm:py-20", className)}>
      <div className="mx-auto max-w-6xl px-4">{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-medium tracking-wider text-primary uppercase">
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className={cn("text-3xl text-balance md:text-5xl", eyebrow && "mt-4")}>
        {title}
      </h2>
      {lead ? (
        <p className="mx-auto mt-5 max-w-[48ch] text-lg leading-relaxed text-balance text-muted-foreground">
          {lead}
        </p>
      ) : null}
    </div>
  );
}

/* A yellow marker pass, reserved for the one idea per section. */
export function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[0.18em] bg-highlight px-[0.15em] text-highlight-foreground box-decoration-clone">
      {children}
    </span>
  );
}
