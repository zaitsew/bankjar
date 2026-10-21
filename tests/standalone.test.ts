import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { allOffers, clearOfferCache, defaultOffersDir, loadOffers } from "../src/server/data";
import { llmsFullTxt } from "../src/server/llms";
import { FIXTURES_DIR } from "./helpers/offers";

/**
 * The droplet runs `node server.js` from a standalone bundle. That bundle has
 * data/offers and docs/METHODOLOGY.md next to server.js and nothing else, so the
 * runtime must find both relative to process.cwd() and not to the source tree.
 */

const tmp: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.BANKJAR_OFFERS_DIR;
  clearOfferCache();
  for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function fakeBundle(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bankjar-bundle-"));
  tmp.push(root);
  fs.cpSync(FIXTURES_DIR, path.join(root, "data", "offers"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs"));
  fs.writeFileSync(path.join(root, "docs", "METHODOLOGY.md"), "# Bundle methodology marker\n");
  return root;
}

describe("standalone bundle layout", () => {
  it("reads data/offers from the working directory", () => {
    const root = fakeBundle();
    vi.spyOn(process, "cwd").mockReturnValue(root);
    expect(defaultOffersDir()).toBe(path.join(root, "data", "offers"));
    expect(allOffers().length).toBe(loadOffers(FIXTURES_DIR).length);
    expect(allOffers().length).toBeGreaterThan(0);
  });

  it("reads docs/METHODOLOGY.md from the working directory", () => {
    const root = fakeBundle();
    vi.spyOn(process, "cwd").mockReturnValue(root);
    expect(llmsFullTxt()).toContain("Bundle methodology marker");
  });
});
