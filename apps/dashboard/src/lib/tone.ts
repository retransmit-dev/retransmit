/**
 * The eight colours the company screen is allowed to use.
 *
 * The product's own accent is coral, and it is spoken for: it means "the
 * product is telling you something" — a score, a live state, a primary action.
 * Nothing on the company screen is telling you anything, so it cannot borrow
 * that colour. What it needs instead is *identity*: eight sections that are
 * told apart at a glance, on a tab strip and again on the panel you land on.
 *
 * Hence a fixed set of hues, one per section, declared once here so the icon
 * on the Certifications tab and the badge inside it are the same green. Each
 * tone is three ready-made class strings rather than a colour, because the
 * light and dark values of a tint are not the same value at two opacities:
 *
 * - `icon`   a bare glyph, no background.
 * - `chip`   a glyph on its own tinted square.
 * - `badge`  a pill of text — a count, a tag.
 *
 * The strings are written out in full. Tailwind reads source files literally,
 * so a class assembled from `text-${hue}-600` would be scanned as nothing and
 * shipped as nothing.
 */

export type Tone =
  | "sky"
  | "violet"
  | "amber"
  | "emerald"
  | "cyan"
  | "rose"
  | "indigo"
  | "slate";

type ToneClasses = {
  badge: string;
  chip: string;
  icon: string;
};

export const tones: Record<Tone, ToneClasses> = {
  amber: {
    badge:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
    chip: "bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300",
    icon: "text-amber-600 dark:text-amber-400",
  },
  cyan: {
    badge:
      "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200",
    chip: "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-400/10 dark:text-cyan-300",
    icon: "text-cyan-600 dark:text-cyan-400",
  },
  emerald: {
    badge:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
    chip: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  indigo: {
    badge:
      "border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-200",
    chip: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-300",
    icon: "text-indigo-600 dark:text-indigo-400",
  },
  rose: {
    badge:
      "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
    chip: "bg-rose-500/10 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300",
    icon: "text-rose-600 dark:text-rose-400",
  },
  sky: {
    badge:
      "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200",
    chip: "bg-sky-500/10 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300",
    icon: "text-sky-600 dark:text-sky-400",
  },
  /* The neutral of the set. Documents are paper; they do not need a hue. */
  slate: {
    badge:
      "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:border-slate-300/20 dark:bg-slate-300/10 dark:text-slate-200",
    chip: "bg-slate-500/10 text-slate-600 dark:bg-slate-300/10 dark:text-slate-300",
    icon: "text-slate-600 dark:text-slate-300",
  },
  violet: {
    badge:
      "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200",
    chip: "bg-violet-500/10 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300",
    icon: "text-violet-600 dark:text-violet-400",
  },
};
