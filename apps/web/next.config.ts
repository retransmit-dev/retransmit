import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  /* Page URLs serve HTML or Markdown depending on the Accept header
     (negotiated in src/proxy.ts), so shared caches must key on Accept.
     Declared here because Next rebuilds Vary itself when serving
     prerendered pages, dropping anything the proxy appends. The value
     restates Next's own router entries so a platform that overwrites
     (rather than appends) the header keeps them; if Next renames them,
     stale names here are harmless.
     The /md and /api handlers set their own headers and are excluded,
     as are Next internals and the static agent files. */
  async headers() {
    return [
      {
        source:
          "/((?!_next/|api/|md/|md$|favicon\\.ico|sitemap\\.xml|robots\\.txt|llms\\.txt|openapi\\.json).*)",
        headers: [
          {
            key: "Vary",
            value:
              "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
