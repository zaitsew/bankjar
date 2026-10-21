import { clearOfferCache } from "../../src/server/data";
import { FIXTURES_DIR, TODAY } from "./offers";

export const SITE = "https://bankjar.test";

/** Point the loader at the fake Testbank fixtures, pin the clock and the origin. */
export function useFixtureEnv(): void {
  process.env.BANKJAR_OFFERS_DIR = FIXTURES_DIR;
  process.env.BANKJAR_TODAY = TODAY;
  process.env.NEXT_PUBLIC_SITE_URL = SITE;
  clearOfferCache();
}

export function get(path: string): Request {
  return new Request(`${SITE}${path}`);
}

export async function json(res: Response): Promise<any> {
  return JSON.parse(await res.text());
}
