import { cookies } from "next/headers";
import { first, type SearchParams } from "./params";

export type Variant = "a" | "b";
export const VARIANT_COOKIE = "bj_v";

/** `?v=b` wins, then the cookie, then A. Only pages that already render per request call this. */
export async function getVariant(sp: SearchParams): Promise<Variant> {
  const q = first(sp.v);
  if (q === "a" || q === "b") return q;
  try {
    const c = (await cookies()).get(VARIANT_COOKIE)?.value;
    if (c === "b") return "b";
  } catch {
    /* no request context */
  }
  return "a";
}
