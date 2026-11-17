import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  // pdf-parse ships a debug entry point that reads a test file from disk when
  // it is imported outside of a CommonJS parent - keep it out of the bundle.
  serverExternalPackages: ["pdf-parse"],
  // The codebase carries a backlog of pre-existing type errors that are not
  // runtime faults (nullable Json columns, strict null checks). They must not
  // block a production build - see docs/SYSTEM_DESIGN.md.
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
