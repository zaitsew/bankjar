import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Every folder under data/ that the server reads at run time must reach the
// deployed bundle: through file tracing (next.config.ts) and the deploy copy.
const root = path.resolve(__dirname, "..");
const dataDirs = fs
  .readdirSync(path.join(root, "data"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

describe("deployed bundle carries every data folder", () => {
  const nextConfig = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");
  const deploy = fs.readFileSync(path.join(root, "scripts/deploy.sh"), "utf8");
  it.each(dataDirs)("data/%s is traced by next.config.ts", (dir) => {
    expect(nextConfig).toContain(`./data/${dir}/**`);
  });
  it.each(dataDirs)("data/%s is copied by scripts/deploy.sh", (dir) => {
    const copyLine = deploy.split("\n").find((l) => /^\s*cp -R data\//.test(l)) ?? "";
    expect(copyLine.split(/\s+/)).toContain(`data/${dir}`);
  });
});
