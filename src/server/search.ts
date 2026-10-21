import { parseIntent, type Intent } from "../core/intent";
import { makeProfile, type Profile, type ProfileInput } from "../core/profile";
import { rankOffers, type RankResult } from "../core/rank";
import type { Goal } from "../core/schema";
import { allOffers, datasetVersion, type DatasetVersion } from "./data";

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
  /** "rules" today; "ai" once the hub parser is on. */
  parser: "rules" | "ai";
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
  const commit = first.offer.commitment_months
    ? ` for a ${first.offer.commitment_months}-month commitment`
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

export function search(input: SearchInput = {}, intentOverride?: Intent): SearchResult {
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
    parser: intentOverride ? "ai" : "rules",
  };
}
