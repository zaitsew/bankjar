import { describe, expect, it } from "vitest";
import {
  appFeatures,
  freshness,
  isAppHidden,
  isAppStale,
  rankApps,
  scoreApp,
  FEATURE_POINTS,
  FRESHNESS_POINTS,
  REACH_POINTS,
  RATING_POINTS,
} from "../src/core/app-score";
import { daysBefore, fixtureApp, fixtureApps, makeApp } from "./helpers/apps";
import { TODAY } from "./helpers/offers";

const line = (app: ReturnType<typeof makeApp>, i: number) => scoreApp(app, TODAY).breakdown[i]!;

describe("scoreApp: rating", () => {
  it("pulls a rating with few ratings towards 3.0 stars", () => {
    const few = makeApp({ ios: { rating: 5, ratings_count: 40 }, android: null });
    const s = scoreApp(few, TODAY);
    expect(s.pooled_rating).toBe(5);
    // (5 x 40 + 3 x 200) / (40 + 200) = 3.33
    expect(s.adjusted_rating).toBe(3.33);
    expect(line(few, 0).points).toBe(10);
  });

  it("scores a 5.0 from 40 ratings below a 4.7 from 100,000", () => {
    const few = makeApp({ ios: { rating: 5, ratings_count: 40 }, android: null });
    const many = makeApp({ ios: { rating: 4.7, ratings_count: 100_000 }, android: null });
    expect(line(few, 0).points).toBeLessThan(line(many, 0).points);
    expect(scoreApp(few, TODAY).score).toBeLessThan(scoreApp(many, TODAY).score);
  });

  it("pools both stores by their rating counts", () => {
    const s = scoreApp(fixtureApp("testbank-app"), TODAY);
    // (4.7 x 100000 + 4.6 x 120000) / 220000 = 4.6455
    expect(s.pooled_rating).toBe(4.65);
    expect(s.total_ratings).toBe(220_000);
    expect(s.adjusted_rating).toBeGreaterThan(4.6);
    expect(s.adjusted_rating).toBeLessThan(s.pooled_rating!);
  });

  it.each([3, 2.4, 0])("gives 0 rating points for %s stars", (stars) => {
    const app = makeApp({ ios: { rating: stars, ratings_count: 100_000 }, android: null });
    expect(line(app, 0).points).toBe(0);
  });

  it("gives the full 60 points for a 5.0 from a very large crowd, and treats no rating as 0 points", () => {
    expect(line(makeApp({ ios: { rating: 5, ratings_count: 10_000_000 }, android: null }), 0).points).toBe(RATING_POINTS);
    const none = scoreApp(makeApp({ ios: { rating: null, ratings_count: 0 }, android: null }), TODAY);
    expect(none.pooled_rating).toBeNull();
    expect(none.breakdown[0]!.points).toBe(0);
  });

  it("flags fewer than 1,000 ratings", () => {
    const few = scoreApp(makeApp({ ios: { rating: 5, ratings_count: 40 }, android: null }), TODAY);
    expect(few.flags).toContain("few ratings (40): rating pulled towards 3.0");
    expect(scoreApp(fixtureApp("testbank-app"), TODAY).flags.some((f) => f.startsWith("few ratings"))).toBe(false);
  });
});

describe("scoreApp: freshness", () => {
  it.each([
    [0, 1],
    [30, 1],
    [105, 0.5],
    [180, 0],
    [400, 0],
  ])("a release %s days ago is worth %s", (days, expected) => {
    expect(freshness(daysBefore(TODAY, days), TODAY)).toBe(expected);
  });

  it("is 0 for a store with no release date", () => {
    expect(freshness(null, TODAY)).toBe(0);
  });

  it("turns days into points: 30, 105 and 180 days give 15, 7.5 and 0", () => {
    for (const [days, points] of [
      [30, FRESHNESS_POINTS],
      [105, 7.5],
      [180, 0],
    ] as const) {
      const d = daysBefore(TODAY, days);
      const app = makeApp({ ios: { updated_on: d }, android: { updated_on: d } });
      expect(line(app, 1).points).toBe(points);
    }
  });

  it("averages the two stores", () => {
    const app = makeApp({ ios: { updated_on: daysBefore(TODAY, 5) }, android: { updated_on: daysBefore(TODAY, 180) } });
    expect(line(app, 1).points).toBe(7.5);
  });

  it("flags a store with no release in 180+ days", () => {
    const app = makeApp({ ios: { updated_on: daysBefore(TODAY, 181) } });
    expect(scoreApp(app, TODAY).flags).toContain("no App Store release in 180+ days");
  });
});

describe("scoreApp: reach", () => {
  it("gives 5 points for both stores and up to 5 for the rating count", () => {
    expect(line(fixtureApp("testbank-app"), 2).points).toBe(REACH_POINTS);
    const small = makeApp({ ios: { ratings_count: 100 }, android: { ratings_count: 0, rating: null } });
    expect(line(small, 2).points).toBe(5);
  });

  it("loses the 5 points and gets a flag for an app in one store", () => {
    const both = makeApp({ ios: { ratings_count: 100_000 }, android: { ratings_count: 100_000 } });
    const iosOnly = makeApp({ ios: { ratings_count: 100_000 }, android: null });
    const androidOnly = makeApp({ ios: null, android: { ratings_count: 100_000 } });
    expect(line(both, 2).points).toBe(10);
    expect(line(iosOnly, 2).points).toBe(5);
    expect(scoreApp(iosOnly, TODAY).flags).toContain("not on Google Play");
    expect(scoreApp(androidOnly, TODAY).flags).toContain("not on the App Store");
    expect(scoreApp(both, TODAY).flags.some((f) => f.startsWith("not on"))).toBe(false);
  });

  it("uses a log scale: 100 ratings give 0 and 100,000 give 5", () => {
    // One store, so only the rating-count part (0 to 5) is in play.
    const pts = (n: number) => line(makeApp({ ios: { ratings_count: n }, android: null }), 2).points;
    expect(pts(100)).toBe(0);
    expect(pts(3_162)).toBe(2.5);
    expect(pts(100_000)).toBe(5);
    expect(pts(5_000_000)).toBe(5);
  });
});

describe("scoreApp: features", () => {
  it("scores 0 for unknown features and lists them in the flags", () => {
    const s = scoreApp(fixtureApp("smallbank-app"), TODAY);
    expect(s.features).toEqual({ bizum: null, apple_pay: null, google_pay: null, english: false });
    expect(s.breakdown[3]!.points).toBe(0);
    expect(s.breakdown[3]!.label).toBe("Features: none confirmed");
    expect(s.flags).toContain("unknown: Bizum, Apple Pay, Google Pay");
  });

  it("gives 3.75 points per confirmed feature, and nothing for a confirmed no", () => {
    const s = scoreApp(fixtureApp("testbank-app"), TODAY);
    expect(s.features).toEqual({ bizum: true, apple_pay: true, google_pay: false, english: true });
    // 3 x 3.75 = 11.25, shown to one decimal
    expect(s.breakdown[3]!.points).toBe(11.3);
    expect(s.breakdown[3]!.label).toBe("Features: Bizum, Apple Pay, English interface");
    expect(s.flags.some((f) => f.startsWith("unknown"))).toBe(false);
    const all = makeApp({
      features: {
        bizum: { value: true, source_url: "https://example.com/a" },
        apple_pay: { value: true, source_url: "https://example.com/b" },
        google_pay: { value: true, source_url: "https://example.com/c" },
      },
    });
    expect(line(all, 3).points).toBe(FEATURE_POINTS);
  });

  it("derives english from the App Store languages, and is unknown without an App Store listing", () => {
    expect(appFeatures(makeApp({ ios: { languages: ["ES", "EN"] } })).english).toBe(true);
    expect(appFeatures(makeApp({ ios: { languages: ["ES", "CA"] } })).english).toBe(false);
    const noIos = makeApp({ ios: null });
    expect(appFeatures(noIos).english).toBeNull();
    expect(scoreApp(noIos, TODAY).flags.find((f) => f.startsWith("unknown"))).toContain("English interface");
  });
});

describe("stale and hidden", () => {
  it.each([
    [30, false, false],
    [31, true, false],
    [60, true, false],
    [61, true, true],
  ])("verified %s days ago: stale %s, hidden %s", (days, stale, hidden) => {
    const app = makeApp({ verified_on: daysBefore(TODAY, days) });
    expect(isAppStale(app, TODAY)).toBe(stale);
    expect(isAppHidden(app, TODAY)).toBe(hidden);
    const s = scoreApp(app, TODAY);
    expect(s.stale).toBe(stale);
    expect(s.hidden).toBe(hidden);
    expect(s.flags.includes("store numbers older than 30 days")).toBe(stale);
  });
});

describe("rankApps", () => {
  it("orders the fixtures by score and leaves hidden apps out", () => {
    const ranked = rankApps(fixtureApps(), TODAY);
    expect(ranked.map((r) => r.app.id)).toEqual(["testbank-app", "oldbank-app", "smallbank-app"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
    const scores = ranked.map((r) => r.score.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(ranked.some((r) => r.app.id === "ghostbank-app")).toBe(false);
  });

  it("breaks a score tie by total ratings, then by bank name", () => {
    // 1,000,000 and 1,000,001 ratings of 5.0 round to the same score; the larger crowd ranks first.
    const a = makeApp({ id: "a-bank", bank: "A Bank", bank_slug: "a-bank", ios: { rating: 5, ratings_count: 1_000_000 }, android: null });
    const z = makeApp({ id: "z-bank", bank: "Z Bank", bank_slug: "z-bank", ios: { rating: 5, ratings_count: 1_000_001 }, android: null });
    expect(scoreApp(a, TODAY).score).toBe(scoreApp(z, TODAY).score);
    expect(rankApps([a, z], TODAY).map((r) => r.app.id)).toEqual(["z-bank", "a-bank"]);

    const same = makeApp({ id: "m-bank", bank: "M Bank", bank_slug: "m-bank", ios: { rating: 5, ratings_count: 1_000_000 }, android: null });
    expect(rankApps([same, a], TODAY).map((r) => r.app.id)).toEqual(["a-bank", "m-bank"]);
    expect(rankApps([a, same], TODAY).map((r) => r.app.id)).toEqual(["a-bank", "m-bank"]);
  });

  it("returns nothing for no apps, and never mutates its input", () => {
    expect(rankApps([], TODAY)).toEqual([]);
    const input = fixtureApps();
    const ids = input.map((a) => a.id);
    rankApps(input, TODAY);
    expect(input.map((a) => a.id)).toEqual(ids);
  });
});
