import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The loader in src/server/data.ts reads data/offers/** at build and run time.
  outputFileTracingIncludes: { "/**": ["./data/offers/**/*.yaml"] },
};

export default nextConfig;
