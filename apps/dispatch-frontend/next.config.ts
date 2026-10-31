import path from "node:path";
import type { NextConfig } from "next";

// The API routes import the generated actor client from <repo>/generated/actors,
// so the root must be the repository, not this app. next and react still
// resolve from this app's node_modules.
const repoRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  agentRules: false,
  // Hide the dev-tools badge: it shows on the projector and in the backup video.
  devIndicators: false,
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
  },
};

export default nextConfig;
