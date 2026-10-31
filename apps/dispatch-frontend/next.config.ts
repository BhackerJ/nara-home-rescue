import type { NextConfig } from "next";

const appRoot = process.cwd();

const nextConfig: NextConfig = {
  // This app lives under apps/ and must not use the repository root,
  // which has its own lockfile and no Next.js install.
  agentRules: false,
  outputFileTracingRoot: appRoot,
  turbopack: {
    root: appRoot,
  },
};

export default nextConfig;
