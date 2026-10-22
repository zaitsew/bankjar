import type { MetadataRoute } from "next";
import { GOALS } from "../src/core/schema";
import { allOffers, datasetVersion } from "../src/server/data";
import { absolute } from "../components/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const offers = allOffers();
  const latest = datasetVersion(offers).latest_verified_on;
  const lastModified = latest ? new Date(`${latest}T00:00:00Z`) : undefined;
  const fixed = ["/", "/leaderboard", "/apps", "/methodology", "/agents"].map((p) => ({
    url: absolute(p),
    lastModified,
    changeFrequency: "daily" as const,
    priority: p === "/" ? 1 : 0.7,
  }));
  const boards = GOALS.map((g) => ({
    url: absolute(`/leaderboard/${g}`),
    lastModified,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));
  const pages = offers.map((o) => ({
    url: absolute(`/offer/${o.id}`),
    lastModified: new Date(`${o.verified_on}T00:00:00Z`),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
  return [...fixed, ...boards, ...pages];
}
