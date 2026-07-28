import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep Redis/BullMQ unbundled so Turbopack hashed externals resolve to
  // top-level packages in the standalone image (nested hoists break otherwise).
  serverExternalPackages: ["playwright", "ioredis", "bullmq"],
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
