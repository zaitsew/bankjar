import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The loader in src/server/data.ts reads data/offers/** at build and run time;
  // /llms-full.txt reads docs/METHODOLOGY.md.
  outputFileTracingIncludes: { "/**": ["./data/offers/**/*.yaml", "./docs/METHODOLOGY.md"] },
};

export default nextConfig;
