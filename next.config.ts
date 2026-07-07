import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Silence the "multiple lockfiles" warning by pinning the Turbopack root
  // to this project (a stray package-lock.json exists in a parent directory).
  turbopack: {
    root: projectRoot,
  },
  // Keep the serverless functions slim. The seeded EPUBs are fetched on
  // demand from GitHub (see lib/cloud.ts), so they must NOT be bundled into
  // the library routes — even though those routes still read the local
  // library directory at runtime (which would otherwise pull the whole
  // project, EPUBs included, into the trace).
  outputFileTracingExcludes: {
    "/api/library": [
      "./library/epubs/**/*",
      "./public/sample.epub",
      "./sample.epub",
      "./scripts/valid.epub",
    ],
    "/api/library/*": [
      "./library/epubs/**/*",
      "./public/sample.epub",
      "./sample.epub",
      "./scripts/valid.epub",
    ],
  },
  // Allow HMR/dev requests from these hosts (e.g. accessing via 127.0.0.1
  // instead of localhost, or from other devices on the LAN at 10.0.0.2).
  allowedDevOrigins: ["127.0.0.1", "localhost", "10.0.0.2"],
};

export default nextConfig;
