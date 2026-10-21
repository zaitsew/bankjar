import type { SearchResult } from "../src/server/search";
import type { ProfileInput } from "../src/core/profile";
import { GOAL_META, commitmentLabel, eur } from "./format";

const RESIDENCY: Record<string, string> = {
  resident: "Resident",
  nie_tie: "NIE or TIE",
  non_resident: "Non-resident",
  unknown: "Not stated",
};

interface Chip {
  key: string;
  label: string;
  value: string;
}

/** The profile as the engine used it: what we read from the question plus the form's filters. */
export function chipsFor(res: SearchResult, overrides: Partial<ProfileInput>): Chip[] {
  const set = { ...res.intent.profile, ...overrides };
  const p = res.profile;
  const goalKnown = res.intent.goal !== null || overrides.goal !== undefined;
  const chips: Chip[] = [
    { key: "goal", label: "Goal", value: GOAL_META[res.goal].short + (goalKnown ? "" : " (default)") },
  ];
  if (set.monthly_income_eur !== undefined && p.monthly_income_eur !== undefined)
    chips.push({ key: "income", label: "Income", value: `${eur(p.monthly_income_eur)}/month` });
  if (set.balance_eur !== undefined) chips.push({ key: "balance", label: "Balance", value: eur(p.balance_eur) });
  if (set.max_commitment_months !== undefined && p.max_commitment_months !== undefined)
    chips.push({
      key: "commit",
      label: "Max commitment",
      value: p.max_commitment_months === 0 ? "None" : commitmentLabel(p.max_commitment_months),
    });
  if (set.residency !== undefined && p.residency !== "unknown")
    chips.push({ key: "res", label: "Residency", value: RESIDENCY[p.residency] ?? p.residency });
  if (set.prefer === "cash") chips.push({ key: "prefer", label: "Rewards", value: "Cash only" });
  chips.push({
    key: "gift",
    label: "Gift factor",
    value: `${Math.round(p.gift_factor * 100)}%`,
  });
  return chips;
}

export function IntentChips({ chips }: { chips: Chip[] }) {
  return (
    <ul className="chips" aria-label="How we read your question">
      {chips.map((c) => (
        <li key={c.key} className="chip">
          <span>{c.label}</span>
          <b>{c.value}</b>
        </li>
      ))}
    </ul>
  );
}
