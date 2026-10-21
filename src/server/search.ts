import { parseIntent, type Intent } from "../core/intent";
import { makeProfile, type Profile, type ProfileInput } from "../core/profile";
import { rankOffers, type RankResult } from "../core/rank";
import type { Goal } from "../core/schema";
import { aiEnabled, mergeIntents, parseIntentWithAI, type ParserName } from "./ai";
import { createLruCache, normalizeQuery, CACHE_MAX_ENTRIES, CACHE_TTL_MS } from "./cache";
import { allOffers, datasetVersion, type DatasetVersion } from "./data";
import { aiLimiter, visitorId } from "./ratelimit";

/**
 * The one search pipeline. The search box, `/api/v1/search` and the MCP tool all call
 * this, so a person and an agent always get the same table.
 *
 * Numbers come only from `data/offers` through the engine. The summary below is a
 * template over ranked rows; an AI summary (when enabled) may only rephrase it.
 */

export const DEFAULT_GOAL: Goal = "salary";

export interface SearchInput {
  q?: string;
  /** Explicit filters win over whatever the parser read from `q`. */
  overrides?: Partial<ProfileInput>;
  today?: string;
}

export interface SearchResult {
  query: string;
  intent: Intent;
  goal: Goal;
  profile: Profile;
  result: RankResult;
  summary: string;
  dataset: DatasetVersion;
  /** Which parser read the question: the rules, the AI alone, or both ("rules+ai"). */
  parser: ParserName;
}

function eur(n: number): string {
  return `€${Math.round(n).toLocaleString("en-GB")}`;
}

export function templateSummary(goal: Goal, result: RankResult): string {
  const [first, second] = result.ranked;
  if (!first) {
    return result.excluded.length
      ? `No offer fits these filters. ${result.excluded.length} offer(s) were left out; see why below.`
      : "No offers for this goal yet.";
  }
  const months = first.offer.commitment_months;
  const commit =
    months == null
      ? " (commitment not stated; check the source)"
      : months > 0
        ? ` for a ${months}-month commitment`
        : " with no commitment";
  let text = `${first.offer.bank} leads: ${first.offer.headline} — about ${eur(first.score.net_value_eur)} net in the first year${commit}.`;
  if (second) {
    text += ` Next: ${second.offer.bank}, about ${eur(second.score.net_value_eur)}.`;
  }
  if (goal === "salary" && result.ranked.some((r) => r.offer.reward.type === "gift")) {
    text += " Gifts count at your gift factor, minus tax on payment in kind.";
  }
  return text;
}

export function search(input: SearchInput = {}, intentOverride?: Intent, parser?: ParserName): SearchResult {
  const query = (input.q ?? "").trim();
  const intent = intentOverride ?? parseIntent(query);
  const profile = makeProfile({ ...intent.profile, ...input.overrides });
  const goal = profile.goal ?? intent.goal ?? DEFAULT_GOAL;
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const offers = allOffers();
  const result = rankOffers(offers, { ...profile, goal }, today);
  return {
    query,
    intent,
    goal,
    profile: { ...profile, goal },
    result,
    summary: templateSummary(goal, result),
    dataset: datasetVersion(offers),
    parser: parser ?? (intentOverride ? "ai" : "rules"),
  };
}

// --- With the optional AI step -------------------------------------------------

/** Rule confidence at or above this, with a goal, is trusted without asking the AI. */
export const AI_SKIP_CONFIDENCE = 0.8;

/** Intents the AI returned, by normalised question. Module-level: best effort on serverless. */
export const intentCache = createLruCache<Intent>(CACHE_MAX_ENTRIES, CACHE_TTL_MS);

export interface SearchContext {
  /** The caller's address; hashed into a daily pseudonym, never stored or sent as is. */
  ip?: string;
}

/**
 * `search` plus the AI step. The rule parser always runs first. The AI is asked only when
 * it is enabled, `q` is not empty, and the rules are unsure (confidence below 0.8 or no goal).
 * A cache hit costs nothing; a rate-limited caller silently gets the rules. Explicit
 * overrides in `input` still win over both parsers, exactly as in `search`.
 */
export async function searchAsync(input: SearchInput = {}, ctx: SearchContext = {}): Promise<SearchResult> {
  const query = (input.q ?? "").trim();
  const rules = parseIntent(query);
  const needsAi = query.length >= 3 && aiEnabled() && (rules.goal === null || rules.confidence < AI_SKIP_CONFIDENCE);
  if (!needsAi) return search(input, undefined, "rules");

  const key = normalizeQuery(query);
  let ai = intentCache.get(key) ?? null;
  if (!ai) {
    const ip = ctx.ip ?? "unknown";
    if (!aiLimiter.take(ip)) return search(input, undefined, "rules");
    ai = await parseIntentWithAI(query, { visitorId: visitorId(ip) });
    if (ai) intentCache.set(key, ai);
  }
  if (!ai) return search(input, undefined, "rules");

  const merged = mergeIntents(rules, ai);
  if (merged.parser === "rules") return search(input, undefined, "rules");
  return search(input, merged.intent, merged.parser);
}
