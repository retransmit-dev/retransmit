import { ImageResponse } from "next/og";

/* Satori has no oklch support, so the card uses hex conversions of the
   globals.css tokens. */
const INK = "#2b2b2b";
const CARD = "#333333";
const PAPER = "#fbfaf9";
const CORAL = "#e16540";
const MUTED = "#a8a5a1";

export const OG_SIZE = { width: 1200, height: 630 } as const;

/* next/font only keeps woff2 on disk and satori cannot read it. Fetching
   the Google Fonts CSS with an old-Chrome user agent makes Google serve a
   plain woff/ttf URL instead. Returns null on failure so a Google outage
   cannot fail the build; satori then falls back to its bundled font. */
async function loadDmSans(weight: 500 | 800): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=DM+Sans:wght@${weight}`,
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1) Chrome/20" } },
    ).then((res) => res.text());
    const match = css.match(
      /src:\s*url\((https:\/\/[^)]+?\.(?:ttf|otf|woff))\)/,
    );
    if (!match) return null;
    const font = await fetch(match[1]);
    if (!font.ok) return null;
    return await font.arrayBuffer();
  } catch {
    return null;
  }
}

export async function renderOgImage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const [heading, body] = await Promise.all([
    loadDmSans(800),
    loadDmSans(500),
  ]);
  const fonts = [
    heading && {
      name: "DM Sans",
      data: heading,
      weight: 800 as const,
      style: "normal" as const,
    },
    body && {
      name: "DM Sans",
      data: body,
      weight: 500 as const,
      style: "normal" as const,
    },
  ].filter((font) => font !== null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: INK,
          padding: 72,
          fontFamily: "DM Sans",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* The favicon glyph (src/app/icon.svg) cropped to its bounds; the
             plane path is pre-rotated because satori ignores transforms. */}
          <svg
            width={52}
            height={52}
            viewBox="190 160 660 660"
            style={{ marginRight: 18 }}
          >
            <path
              d="M 736.1 452.0 A 232 232 0 1 1 532.2 280.9"
              fill="none"
              stroke={CORAL}
              strokeWidth={92}
              strokeLinecap="round"
            />
            <path
              d="M 791.0 195.9 L 589.4 298.4 L 670.7 316.1 L 688.4 397.4 Z"
              fill={CORAL}
            />
          </svg>
          <span
            style={{
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: "-0.025em",
              color: PAPER,
            }}
          >
            retransmit
          </span>
          <span style={{ fontSize: 36, fontWeight: 800, color: CORAL }}>.</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: title.length > 52 ? 62 : 74,
              fontWeight: 800,
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
              color: PAPER,
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 30,
              fontWeight: 500,
              lineHeight: 1.4,
              color: MUTED,
              maxWidth: 940,
            }}
          >
            {description}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 28, fontWeight: 500, color: CORAL }}>
            retransmit.dev
          </span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: MUTED,
              backgroundColor: CARD,
              borderRadius: 999,
              padding: "10px 24px",
            }}
          >
            Open source email API
          </span>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length > 0 ? fonts : undefined },
  );
}
