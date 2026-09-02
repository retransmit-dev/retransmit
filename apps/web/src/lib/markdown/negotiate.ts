/* Proactive content negotiation between the HTML and Markdown
   representations of a page, per RFC 9110 §12.5.1. Pure string logic so
   the proxy (edge runtime) and tests can both use it.

   Rules that matter and are easy to get wrong:
   - q defaults to 1 and ranges 0..1; q=0 means "never send me this".
   - The most specific matching entry decides the q for a type: an exact
     type beats a subtype wildcard, which beats the full wildcard. The
     highest q does not win on its own.
   - A missing Accept header or a bare full wildcard means "no
     constraint": serve the default (HTML). Markdown is only chosen when
     the client names text/markdown explicitly and ranks it at least as
     high as HTML.
   - When nothing matches with q > 0, the answer is 406. */

export type Negotiated = "html" | "markdown" | "not-acceptable";

type AcceptEntry = {
  type: string;
  subtype: string;
  q: number;
};

const MARKDOWN = ["text", "markdown"] as const;
const HTML = ["text", "html"] as const;

function parseAccept(header: string): AcceptEntry[] {
  const entries: AcceptEntry[] = [];
  for (const raw of header.split(",")) {
    const [media, ...params] = raw.trim().split(";");
    if (!media) continue;
    const [type, subtype] = media.trim().toLowerCase().split("/");
    if (!type || !subtype) continue;

    let q = 1;
    for (const param of params) {
      const [key, value] = param.trim().split("=");
      if (key?.trim().toLowerCase() !== "q" || value === undefined) continue;
      const parsed = Number.parseFloat(value.trim());
      if (Number.isFinite(parsed)) q = Math.min(1, Math.max(0, parsed));
    }
    entries.push({ type, subtype, q });
  }
  return entries;
}

/* Specificity: exact match 2, subtype wildcard 1, full wildcard 0,
   no match -1. */
function specificity(entry: AcceptEntry, [type, subtype]: readonly [string, string]) {
  if (entry.type === type && entry.subtype === subtype) return 2;
  if (entry.type === type && entry.subtype === "*") return 1;
  if (entry.type === "*" && entry.subtype === "*") return 0;
  return -1;
}

/* The q of the most specific entry matching the given type, plus how
   specific that entry was. No match scores q 0. */
function match(entries: AcceptEntry[], target: readonly [string, string]) {
  let best = { specificity: -1, q: 0 };
  for (const entry of entries) {
    const level = specificity(entry, target);
    if (level > best.specificity) best = { specificity: level, q: entry.q };
  }
  return best;
}

/**
 * Picks the representation to serve for a page that exists as both HTML
 * and Markdown. HTML stays the default; Markdown wins only when the
 * client names it and ranks it at least as high as HTML.
 */
export function negotiate(acceptHeader: string | null | undefined): Negotiated {
  if (acceptHeader === null || acceptHeader === undefined) return "html";
  const trimmed = acceptHeader.trim();
  if (trimmed === "") return "html";

  const entries = parseAccept(trimmed);
  if (entries.length === 0) return "html";

  const markdown = match(entries, MARKDOWN);
  const html = match(entries, HTML);

  if (markdown.q === 0 && html.q === 0) return "not-acceptable";
  if (markdown.q === 0) return "html";
  if (html.q === 0) return "markdown";

  if (markdown.q > html.q) return "markdown";
  if (markdown.q < html.q) return "html";

  /* Equal q. Serve Markdown only when the client asked for it by name
     with at least the specificity of its HTML match; browsers never
     name text/markdown, agents that want it do. */
  if (markdown.specificity === 2 && markdown.specificity >= html.specificity) {
    return "markdown";
  }
  return "html";
}
