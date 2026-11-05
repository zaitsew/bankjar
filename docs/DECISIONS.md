# Decisions

An ADR log. One entry per decision that would otherwise be re-litigated —
not every choice, just the ones somebody will ask "wait, why did we do it
this way" about later.

## 2026-01-01 — example: this is the format

**Context.** What made a decision necessary — the fork in the road, in a
sentence or two.

**Decision.** What was chosen.

**Why.** The reasoning, short. Not a transcript of the debate — the part
worth remembering.

**Status.** Accepted | Superseded by <link> | Reverted on <date>, because <why>.

## 2026-11-05 — fresh data before more reach, and before more features

**Context.** Anthropic approved the connector, so more people and agents may soon read BankJar's numbers. All 69 offers were last checked on 2026-10-22. They go stale on 2026-11-21 and leave the rankings on 2026-12-21. Nothing re-checks them yet.

**Decision.** Sprint 2 is the verifier, a full re-check and the wrong-offer report, with a 2026-11-21 deadline. Selling comes next, then Spanish, then Blind pick and the change-history page. More countries, more products and the stdio package wait until the verifier keeps Spain fresh unattended.

**Why.** A stale bonus quoted as current is a wrong answer about someone's money, and every new country or product adds rows that expire. Grok and Codex both named wrong or stale numbers as the biggest risk, and both deferred Blind pick and the change-history page. They differ on the first step: Grok re-checks first, Codex asks the lawyer first. Both run in parallel here, since only the owner can do the second. No fee feature is added or removed on a guess.

**Status.** Accepted.
