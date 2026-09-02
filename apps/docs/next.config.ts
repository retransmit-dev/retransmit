import type { NextConfig } from "next";
import nextra from "nextra";

const withNextra = nextra({
  defaultShowCopyCode: true,
});

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/domains", destination: "/email/domains", permanent: true },
      {
        source: "/marketing-email",
        destination: "/email/marketing-email",
        permanent: true,
      },
      {
        source: "/api-reference/send-email",
        destination: "/email/send",
        permanent: true,
      },
      {
        source: "/api-reference/send-batch",
        destination: "/email/send-batch",
        permanent: true,
      },
      {
        source: "/api-reference/get-email",
        destination: "/email/get",
        permanent: true,
      },
      {
        source: "/api-reference/get-batch",
        destination: "/email/get-batch",
        permanent: true,
      },
      {
        source: "/api-reference/send-sms",
        destination: "/sms/send",
        permanent: true,
      },
      {
        source: "/api-reference/get-sms",
        destination: "/sms/get",
        permanent: true,
      },
    ];
  },
  turbopack: {
    resolveAlias: {
      // Nextra needs this to find the MDX components under Turbopack.
      "next-mdx-import-source-file": "./src/mdx-components.tsx",
    },
  },
};

export default withNextra(nextConfig);
