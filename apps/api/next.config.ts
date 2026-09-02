import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg-boss (and its pg driver) use dynamic requires that must not be bundled.
  serverExternalPackages: ["pg-boss", "pg"],
};

export default nextConfig;
