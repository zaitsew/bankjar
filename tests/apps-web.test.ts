import fs from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import AppsPage from "../app/apps/page";
import sitemap from "../app/sitemap";
import { latestRelease } from "../components/AppTable";
import { headingId } from "../components/Markdown";
import { parseBlocks } from "../components/markdown-parse";
import { FEATURE_POINTS, FRESHNESS_POINTS, OLD_DAYS, FRESH_DAYS, PRIOR_RATINGS, REACH_POINTS, RATING_POINTS } from "../src/core/app-score";
import { fixtureApp } from "./helpers/apps";
import { SITE, useFixtureEnv } from "./helpers/api";

beforeAll(() => {
  useFixtureEnv();
  // The page reads the clock through components/format; pin it to the fixtures' day.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
});
afterAll(() => {
  vi.useRealTimers();
});

const html = () => renderToStaticMarkup(createElement(AppsPage));

describe("/apps page", () => {
  it("has the title, the intro, the methodology link and a captioned table", () => {
    const h = html();
    expect(h).toContain(">Bank apps</h1>");
    expect(h).toContain("Spanish bank apps ranked by store ratings, release freshness, reach and payment features.");
    expect(h).toContain('href="/methodology#bank-apps"');
    expect(h).toContain("<caption");
    expect(h).toContain("Spanish bank apps ranked by score out of 100");
    expect(h).toContain('scope="col"');
  });

  it("lists the ranked apps in order and leaves the hidden one out", () => {
    const h = html();
    const order = ["Testbank", "Oldbank", "Smallbank"].map((n) => h.indexOf(`>${n}</span>`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(h).not.toContain("Ghostbank");
  });

  it("shows ratings and counts linked to each store, and says when a store is missing", () => {
    const h = html();
    expect(h).toContain('href="https://apps.apple.com/es/app/id100000001"');
    expect(h).toContain('href="https://play.google.com/store/apps/details?id=com.example.testbank&amp;gl=ES"');
    expect(h).toContain("4.70");
    expect(h).toContain("100,000 ratings");
    expect(h).toContain("120,000 ratings");
    expect(h).toContain("Not on Google Play");
    expect(h).toContain("No rating yet");
    expect(h).toContain('rel="nofollow noopener"');
  });

  it("shows a bold score out of 100 and an expandable breakdown without client JavaScript", () => {
    const h = html();
    const score = fixtureScore();
    expect(h).toContain(`<span class="net">${score}</span><span class="muted"> / 100</span>`);
    expect(h).toContain("<details");
    expect(h).toContain(">Breakdown</summary>");
    expect(h).toContain("/ 60</span>");
    expect(h).not.toContain("<script");
  });

  it("shows the newest release of the two stores, as a date", () => {
    expect(latestRelease(fixtureApp("testbank-app"))).toBe("2026-10-18");
    expect(latestRelease(fixtureApp("oldbank-app"))).toBe("2026-03-01");
    const h = html();
    expect(h).toContain('<time dateTime="2026-10-18" class="num">18 Oct 2026</time>');
    expect(h).toContain("3 days ago");
  });

  it("marks every feature as yes, no or unknown in text, not by colour alone", () => {
    const h = html();
    expect(h).toContain("Bizum: yes");
    expect(h).toContain("Google Pay: no");
    expect(h).toContain("Apple Pay: unknown");
    expect(h).toContain("badge-unknown");
    expect(h).toContain("English interface: yes");
    expect(h).toContain('title="Bizum: yes"');
  });

  it("shows the checked date, a stale badge for old numbers and the data date", () => {
    const h = html();
    expect(h).toContain("10 Sep 2026");
    expect(h).toContain("badge-stale");
    expect(h.match(/badge-stale/g)).toHaveLength(1); // oldbank, 41 days; smallbank at 20 days and testbank are fresh
  });

  it("explains the Google Play count and the shrink, and gives the data date", () => {
    const h = html();
    expect(h).toContain("Google Play&#x27;s rating count is worldwide; its average is the one Play shows in Spain.");
    expect(h).toContain("Ratings are pulled towards 3.0 stars when an app has few of them.");
    expect(h).toContain("Data checked up to 21 Oct 2026.");
  });

  it("links to the bank's top offer when the bank has offers, and to nothing otherwise", () => {
    const h = html();
    expect(h).toContain('href="/offer/testbank-phone-gift"');
    expect(h.match(/>Top offer/g)).toHaveLength(1);
  });
});

function fixtureScore(): string {
  const h = html();
  const m = /<span class="net">([\d.]+)<\/span>/.exec(h);
  return m![1]!;
}

describe("sitemap and methodology", () => {
  it("lists /apps", () => {
    expect(sitemap().map((e) => e.url)).toContain(`${SITE}/apps`);
  });

  it("has anchors on headings", () => {
    expect(headingId("Bank apps")).toBe("bank-apps");
    expect(headingId("Two numbers per offer")).toBe("two-numbers-per-offer");
  });

  it("explains the bank-app rules with the numbers the code uses", () => {
    const md = fs.readFileSync("docs/METHODOLOGY.md", "utf8");
    const blocks = parseBlocks(md);
    expect(blocks).toContainEqual({ t: "h", level: 2, text: "Bank apps" });
    const section = md.slice(md.indexOf("## Bank apps"), md.indexOf("## Not advice"));
    expect(section).toContain(`**Rating, ${RATING_POINTS} points.**`);
    expect(section).toContain(`**Freshness, ${FRESHNESS_POINTS} points.**`);
    expect(section).toContain(`**Reach, ${REACH_POINTS} points.**`);
    expect(section).toContain(`**Features, ${FEATURE_POINTS} points.**`);
    expect(section).toContain(`${PRIOR_RATINGS} more ratings of 3.0`);
    expect(section).toContain(`last ${FRESH_DAYS} days`);
    expect(section).toContain(`${OLD_DAYS} days ago or more`);
    expect(section).toContain("npm run fetch-apps");
    expect(section).toContain("`source_url`");
  });
});
