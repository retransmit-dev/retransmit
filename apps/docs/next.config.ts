import type { NextConfig } from "next";
import nextra from "nextra";

const withNextra = nextra({
  defaultShowCopyCode: true,
});

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // Nextra needs this to find the MDX components under Turbopack.
      "next-mdx-import-source-file": "./src/mdx-components.tsx",
    },
  },
};

export default withNextra(nextConfig);
