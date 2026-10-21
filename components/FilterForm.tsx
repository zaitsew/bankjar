import type { ProfileInput } from "../src/core/profile";
import type { SearchResult } from "../src/server/search";
import { GOALS } from "../src/core/schema";
import { GOAL_META } from "./format";

/**
 * Plain GET form: no JavaScript needed. Values override what the parser read from the question.
 * Blank fields fall back to the parser.
 */
export function FilterForm({ res, explicit }: { res: SearchResult; explicit: Partial<ProfileInput> }) {
  const p = res.profile;
  return (
    <details className="disc">
      <summary>Edit filters</summary>
      <form action="/search" method="get" className="panel mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <input type="hidden" name="q" value={res.query} />
        {res.profile.prefer === "cash" ? <input type="hidden" name="prefer" value="cash" /> : null}
        <div className="field">
          <label htmlFor="f-goal">Goal</label>
          <select id="f-goal" name="goal" className="input" defaultValue={res.goal}>
            {GOALS.map((g) => (
              <option key={g} value={g}>
                {GOAL_META[g].short}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-income">Net monthly income, EUR</label>
          <input id="f-income" name="income" type="number" min="0" step="any" inputMode="numeric" className="input" defaultValue={p.monthly_income_eur ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="f-commit">Longest commitment, months (0 = none)</label>
          <input id="f-commit" name="max_commitment" type="number" min="0" step="1" inputMode="numeric" className="input" defaultValue={p.max_commitment_months ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="f-res">Residency</label>
          <select id="f-res" name="residency" className="input" defaultValue={p.residency === "unknown" ? "" : p.residency}>
            <option value="">Not stated</option>
            <option value="resident">Resident</option>
            <option value="nie_tie">NIE or TIE</option>
            <option value="non_resident">Non-resident</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-gift">Gift factor, 0 to 1</label>
          <input id="f-gift" name="gift_factor" type="number" min="0" max="1" step="0.05" inputMode="decimal" className="input" placeholder={String(p.gift_factor)} defaultValue={explicit.gift_factor ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="f-balance">Balance to park, EUR</label>
          <input id="f-balance" name="balance" type="number" min="0" step="any" inputMode="numeric" className="input" placeholder={String(p.balance_eur)} defaultValue={explicit.balance_eur ?? ""} />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
          <button type="submit" className="btn btn-primary">
            Apply filters
          </button>
          <a className="btn" href={`/search?q=${encodeURIComponent(res.query)}`}>
            Reset filters
          </a>
          <p className="t-caption muted">Blank fields use what we read from your question.</p>
        </div>
      </form>
    </details>
  );
}
