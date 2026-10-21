import path from "node:path";
import { OfferSchema, type Offer } from "../../src/core/schema";
import { loadOffers } from "../../src/server/data";

export const FIXTURES_DIR = path.join(__dirname, "..", "fixtures", "offers");
export const TODAY = "2026-10-21";

export function fixtures(): Offer[] {
  return loadOffers(FIXTURES_DIR);
}

export function fixture(id: string): Offer {
  const o = fixtures().find((f) => f.id === id);
  if (!o) throw new Error(`no fixture ${id}`);
  return o;
}

type Deep<T> = { [K in keyof T]?: T[K] extends object ? Deep<T[K]> : T[K] };

/** A valid offer (a copy of the cash fixture) with overrides merged one level deep. */
export function makeOffer(overrides: Deep<Offer> & { id?: string } = {}): Offer {
  const base = structuredClone(fixture("testbank-payroll-cash")) as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    const current = base[key];
    if (value !== null && typeof value === "object" && !Array.isArray(value) && current && typeof current === "object") {
      base[key] = { ...(current as object), ...(value as object) };
    } else {
      base[key] = value;
    }
  }
  return OfferSchema.parse(base);
}
