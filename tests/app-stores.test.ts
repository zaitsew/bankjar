import { describe, expect, it } from "vitest";
import { parsePlayDate, parsePlayPage } from "../src/server/app-stores";

describe("parsePlayDate", () => {
  it("reads Google Play's date format", () => {
    expect(parsePlayDate("Oct 21, 2026")).toBe("2026-10-21");
    expect(parsePlayDate("Jan 5, 2025")).toBe("2025-01-05");
    expect(parsePlayDate("  Dec 31, 2026 ")).toBe("2026-12-31");
  });
  it.each(["", "2026-10-21", "21 Oct 2026", "Xyz 21, 2026", "Oct 21 2026", "Oct 21, 26"])(
    "gives null for %j",
    (s) => {
      expect(parsePlayDate(s)).toBeNull();
    },
  );
});

const LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Testbank Mobile",
  aggregateRating: { "@type": "AggregateRating", ratingValue: "4.6491", ratingCount: "120345" },
});

describe("parsePlayPage", () => {
  it("reads the rating, the count and the release date", () => {
    const html = `<html><head><script type="application/ld+json">${LD}</script></head><body>
      <div class="a">About</div><div class="b">Updated on</div><div class="x">Oct 21, 2026</div></body></html>`;
    expect(parsePlayPage(html)).toEqual({ rating: 4.65, ratings_count: 120345, updated_on: "2026-10-21" });
  });

  it("skips JSON-LD blocks of other types and blocks that are not JSON", () => {
    const html = `<script type="application/ld+json">{"@type":"Organization","name":"x"}</script>
      <script type="application/ld+json">{ not json</script>
      <script type="application/ld+json">${LD}</script>`;
    expect(parsePlayPage(html)).toMatchObject({ rating: 4.65, ratings_count: 120345, updated_on: null });
  });

  it("gives no rating when the count is 0, and nulls for an empty page", () => {
    const none = JSON.stringify({ "@type": "SoftwareApplication", aggregateRating: { ratingValue: "0", ratingCount: "0" } });
    expect(parsePlayPage(`<script type="application/ld+json">${none}</script>`)).toEqual({ rating: null, ratings_count: 0, updated_on: null });
    expect(parsePlayPage("<html></html>")).toEqual({ rating: null, ratings_count: 0, updated_on: null });
  });

  it("gives a null date when the date text is not a date", () => {
    expect(parsePlayPage(`<div>Updated on</div><div class="x">soon<`).updated_on).toBeNull();
  });
});
