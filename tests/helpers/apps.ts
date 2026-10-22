import path from "node:path";
import { AppSchema, type BankApp } from "../../src/core/app-schema";
import { loadApps } from "../../src/server/apps";

export const APP_FIXTURES_DIR = path.join(__dirname, "..", "fixtures", "apps");

export function fixtureApps(): BankApp[] {
  return loadApps(APP_FIXTURES_DIR);
}

export function fixtureApp(id: string): BankApp {
  const a = fixtureApps().find((f) => f.id === id);
  if (!a) throw new Error(`no app fixture ${id}`);
  return a;
}

type Deep<T> = {
  [K in keyof T]?: NonNullable<T[K]> extends readonly unknown[]
    ? T[K]
    : NonNullable<T[K]> extends object
      ? Deep<NonNullable<T[K]>> | Extract<T[K], null>
      : T[K];
};

/**
 * A valid app (a copy of the Testbank fixture) with overrides merged one level deep.
 * A store passed as an object is merged into the fixture's store; pass null to remove it.
 */
export function makeApp(overrides: Deep<BankApp> = {}): BankApp {
  const base = structuredClone(fixtureApp("testbank-app")) as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    const current = base[key];
    if (value !== null && typeof value === "object" && !Array.isArray(value) && current && typeof current === "object") {
      base[key] = { ...(current as object), ...(value as object) };
    } else {
      base[key] = value;
    }
  }
  return AppSchema.parse(base);
}

/** The ISO date `days` before `from` (UTC). */
export function daysBefore(from: string, days: number): string {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
