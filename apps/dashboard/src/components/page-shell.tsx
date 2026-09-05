import { findNavPage } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { Route } from "next";
import type { ReactNode } from "react";

/**
 * The one frame every screen under `(dashboard)` sits in.
 *
 * Two pieces: `PageShell` owns the column — its width, its horizontal
 * position and the rhythm between the blocks inside it — and `PageHeader`
 * owns the title row. A page renders a shell, a header and its content;
 * nothing else sets page padding or picks a heading size, which is what keeps
 * `/company` and `/opportunity` from drifting apart.
 *
 * The column fills whatever the inset gives it, so collapsing the sidebar
 * hands the freed space to the page. Only past the `size` cap does it stop
 * growing and centre, so on a very wide monitor the content sits in the
 * middle rather than hugging the sidebar with a void on the right. The cap
 * is a plain width, not a breakpoint: what matters is the space left after
 * the sidebar, which no viewport query can see.
 */

const widths = {
  /**
   * Lists, tables, dashboards — most screens. Wide enough that a 1440px
   * display with the sidebar collapsed, or a 1920px one with it open, still
   * uses the whole inset.
   */
  default: "max-w-[100rem]",
  /** Prose and forms, where a short measure reads better. */
  narrow: "max-w-3xl",
  /** Wide tables and split layouts that need the whole inset. */
  full: "max-w-none",
} as const;

export function PageShell({
  size = "default",
  className,
  children,
}: {
  size?: keyof typeof widths;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full min-w-0 flex-col gap-6",
        widths[size],
        className,
      )}
    >
      {children}
    </div>
  );
}

type PageHeaderProps = {
  /**
   * Registry route to read the title and description from, so a heading is
   * never typed twice. `title`/`description` override it when a screen needs
   * to say something the sidebar label cannot.
   */
  href?: Route;
  title?: ReactNode;
  description?: ReactNode;
  /**
   * Buttons, dropdown menus or anything else that acts on the whole page.
   * Sits on the right of the title on wide screens and wraps under it when
   * there is no room.
   */
  actions?: ReactNode;
  /** Tabs, filters or search that belong to the page rather than its content. */
  children?: ReactNode;
  /**
   * `2` when a parent layout already renders the page title — the opportunity
   * tabs, for one. The block then reads as a section inside that page instead
   * of competing with it, and the document keeps a single `h1`.
   */
  level?: 1 | 2;
  className?: string;
};

export function PageHeader({
  href,
  title,
  description,
  actions,
  children,
  level = 1,
  className,
}: PageHeaderProps) {
  const page = href ? findNavPage(href) : undefined;
  const heading = title ?? page?.title;
  const summary = description ?? page?.description;
  const Heading = level === 1 ? "h1" : "h2";

  return (
    <header className={cn("flex flex-col gap-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-2xl">
          <Heading
            className={cn(
              "font-semibold tracking-tight text-balance",
              level === 1 ? "text-xl" : "text-base",
            )}
          >
            {heading}
          </Heading>
          {summary ? (
            <p className="mt-1.5 text-sm/relaxed text-muted-foreground">
              {summary}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>

      {children}
    </header>
  );
}
