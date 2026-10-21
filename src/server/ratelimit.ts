import { createHash, randomBytes } from "node:crypto";

/**
 * A fixed-window limiter for AI calls only. Over the limit the caller skips the AI and the
 * rule parser answers, so the person never sees an error. State is per server instance:
 * on serverless it is a best-effort brake, and the accounts hub's EUR ceiling is the hard one.
 */

export interface Limiter {
  /** True and counted when the call may go ahead; false (nothing counted) when it may not. */
  take(key: string): boolean;
  reset(): void;
}

export interface LimiterOptions {
  perKey: number;
  global: number;
  windowMs: number;
  /** Most distinct keys tracked in one window; beyond it new keys are refused. */
  maxKeys?: number;
  now?: () => number;
}

export function createLimiter(opts: LimiterOptions): Limiter {
  const now = opts.now ?? Date.now;
  const maxKeys = opts.maxKeys ?? 10_000;
  let window = Math.floor(now() / opts.windowMs);
  let total = 0;
  const counts = new Map<string, number>();
  const roll = () => {
    const current = Math.floor(now() / opts.windowMs);
    if (current !== window) {
      window = current;
      total = 0;
      counts.clear();
    }
  };
  return {
    take(key) {
      roll();
      const used = counts.get(key);
      if (used === undefined && counts.size >= maxKeys) return false;
      if ((used ?? 0) >= opts.perKey || total >= opts.global) return false;
      counts.set(key, (used ?? 0) + 1);
      total += 1;
      return true;
    },
    reset() {
      window = Math.floor(now() / opts.windowMs);
      total = 0;
      counts.clear();
    },
  };
}

export const AI_PER_IP_PER_HOUR = 20;
export const AI_GLOBAL_PER_HOUR = 600;

export const aiLimiter: Limiter = createLimiter({
  perKey: AI_PER_IP_PER_HOUR,
  global: AI_GLOBAL_PER_HOUR,
  windowMs: 60 * 60 * 1000,
});

/** The caller's address: first hop of `x-forwarded-for`, else `x-real-ip`, else "unknown". */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Without BANKJAR_VISITOR_SALT each process draws its own secret salt. A public constant
 * would let anyone holding hub records hash every IPv4 address and recover visitors.
 */
const PROCESS_SALT = randomBytes(32).toString("hex");

/**
 * A stable-for-a-day pseudonym for the hub's `x-accounts-external-user`: the first 16 hex
 * characters of sha256(ip, salt, UTC day). The raw address is never stored or sent, and the
 * pseudonym changes every day, so it cannot follow a person across days.
 */
export function visitorId(ip: string, now: Date = new Date()): string {
  const salt = process.env.BANKJAR_VISITOR_SALT?.trim() || PROCESS_SALT;
  const day = now.toISOString().slice(0, 10);
  return createHash("sha256").update(`${ip}|${salt}|${day}`).digest("hex").slice(0, 16);
}
