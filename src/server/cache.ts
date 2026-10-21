/**
 * A small in-memory LRU with a time-to-live. Module-level state is fine on a serverless
 * host: a warm instance reuses it, a cold one starts empty. It is a best-effort saving on
 * AI calls, never a source of truth.
 */

export interface LruCache<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  clear(): void;
  readonly size: number;
}

export function createLruCache<V>(max: number, ttlMs: number, now: () => number = Date.now): LruCache<V> {
  const map = new Map<string, { value: V; expires: number }>();
  return {
    get(key) {
      const hit = map.get(key);
      if (!hit) return undefined;
      if (hit.expires <= now()) {
        map.delete(key);
        return undefined;
      }
      // Re-insert so the most recently used entry is the last in iteration order.
      map.delete(key);
      map.set(key, hit);
      return hit.value;
    },
    set(key, value) {
      map.delete(key);
      map.set(key, { value, expires: now() + ttlMs });
      while (map.size > max) {
        const oldest = map.keys().next();
        if (oldest.done) break;
        map.delete(oldest.value);
      }
    },
    clear() {
      map.clear();
    },
    get size() {
      return map.size;
    },
  };
}

/** The same question, differently spaced or cased, is one cache entry. */
export function normalizeQuery(q: string): string {
  return q.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export const CACHE_MAX_ENTRIES = 500;
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
