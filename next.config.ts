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
  // Ship the seeded EPUBs with the library route handlers so serverless
  // deployments (e.g. Vercel) can read them from disk at runtime.
  outputFileTracingIncludes: {
    "/api/library": ["./library/epubs/**/*"],
    "/api/library/*": ["./library/epubs/**/*"],
  },
  // Allow HMR/dev requests from these hosts (e.g. accessing via 127.0.0.1
  // instead of localhost, or from other devices on the LAN at 10.0.0.2).
  allowedDevOrigins: ["127.0.0.1", "localhost", "10.0.0.2"],
};

export default nextConfig;
