import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server (.next/standalone) that the droplet runs with plain
  // `node server.js`. The box has 1 GB of RAM and cannot compile Next, so
  // scripts/deploy.sh builds on the laptop and ships this output.
  output: "standalone",
  // No image optimizer: it needs `sharp`, a native dependency. The trace still lists
  // the Mac build of sharp (it is an optional dependency of next); scripts/deploy.sh
  // prunes it, because the droplet is linux/amd64 and nothing here loads it.
  images: { unoptimized: true },
  // The loader in src/server/data.ts reads data/offers/** at build and run time;
  // /llms-full.txt reads docs/METHODOLOGY.md.
  outputFileTracingIncludes: { "/**": ["./data/offers/**/*.yaml", "./docs/METHODOLOGY.md"] },
};

export default nextConfig;
