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
          {/* The favicon glyph (src/app/icon.svg) cropped to its bounds. */}
          <svg
            width={52}
            height={52}
            viewBox="92 92 840 840"
            style={{ marginRight: 18 }}
          >
            <path fill={CORAL} fillRule="evenodd" d="M139.2 94C123.4 97.5 111.8 106.8 105 121.2L102.1 127.6L102.1 513.5L102.1 899.3L106.8 908.6C110.1 915.2 113.4 919.2 118.2 922.9C130.6 932.3 128.3 932.1 227.2 931.7L315.8 931.3L323.4 927.6C332.6 923 342.1 913 345.6 904C347.9 898.1 348 890.3 348.3 763.3C348.4 689.4 348.6 627.6 348.7 625.8L348.7 622.9L390.1 622.9L431.4 623L440.4 636.1C451 651.5 458.6 662.5 514 741.8C537.3 775 560.2 808.1 565.1 815.1C601.6 867.8 625.6 901 631.1 907C639.4 916.1 651.9 924.2 663.9 928.2L673.3 931.3L784 931.7C906.6 932.1 904.2 932.3 914 923.5C923.7 915.2 925 905.7 918.2 894.2C915.7 890.2 902.6 871.5 888.9 852.7C865.1 820 819.2 756.7 763.3 679.3C749.2 659.7 730.8 634.4 722.5 623C714.1 611.7 707.6 602.3 707.8 602.2C708.1 601.9 713.2 599.9 719.2 597.5C744.9 587.3 768.7 571 792.2 547.6C812.1 527.9 824.1 511.6 835.1 489.2C853.1 452.5 860.8 416.3 860.8 367.5C860.8 319.5 853.1 282.3 835.6 245.1C802.4 174.8 731.3 121.3 645.7 102.3C600.2 92.1 594.5 92 356.8 92.1C183.8 92.1 146.3 92.5 139.2 94ZM561.7 285.9C581.5 291.9 599.1 304.6 609.7 321C628.1 349.4 625.7 389.6 604.1 414.8C598 421.8 584.2 431.5 573.8 435.7C557.3 442.5 553.7 442.8 447.5 442.8L348.7 442.8L348.7 404.7C348.6 383.9 348.3 349.9 348 329.2C347.8 308.5 347.9 289.6 348.3 287.1L349 282.7L451.4 283.1C544.5 283.5 554.3 283.8 561.7 285.9Z" />
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
