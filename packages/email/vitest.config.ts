import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The db module builds a connection pool at import time. Nothing under
    // test queries it, but the URL has to parse.
    env: { DATABASE_URL: "postgres://user:pass@127.0.0.1:5432/test" },
  },
});
