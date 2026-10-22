import { clearAppCache } from "../../src/server/apps";
import { clearOfferCache } from "../../src/server/data";
import { APP_FIXTURES_DIR } from "./apps";
import { FIXTURES_DIR, TODAY } from "./offers";

export const SITE = "https://bankjar.test";

/** Point the loaders at the fake Testbank fixtures (offers and apps), pin the clock and the origin. */
export function useFixtureEnv(): void {
  process.env.BANKJAR_OFFERS_DIR = FIXTURES_DIR;
  process.env.BANKJAR_APPS_DIR = APP_FIXTURES_DIR;
  process.env.BANKJAR_TODAY = TODAY;
  process.env.NEXT_PUBLIC_SITE_URL = SITE;
  clearOfferCache();
  clearAppCache();
}

export function get(path: string): Request {
  return new Request(`${SITE}${path}`);
}

export async function json(res: Response): Promise<any> {
  return JSON.parse(await res.text());
}
