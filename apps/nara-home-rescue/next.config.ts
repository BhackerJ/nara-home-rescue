import type { NextConfig } from "next";

const appRoot = process.cwd();

const nextConfig: NextConfig = {
  agentRules: false,
  // Hide the dev-tools badge: it shows on the projector and in the backup video.
  devIndicators: false,
  outputFileTracingRoot: appRoot,
  turbopack: {
    root: appRoot,
  },
  // The case API lives in apps/dispatch-frontend (:3100). Proxy it so the browser stays same-origin.
  async rewrites() {
    return [{ source: "/api/:path*", destination: "http://localhost:3100/api/:path*" }];
  },
};

export default nextConfig;
