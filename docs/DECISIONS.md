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

## 2026-11-14 — expand with official benchmarks, not more hand-kept products

**Context.** The owner asked how to expand BankJar with banking, finance and investment data. The 2026-11-05 decision deferred new products until the verifier keeps Spain fresh unattended.

**Decision.** Sprint 2b adds official reference numbers beside the offers: ECB rates and €STR, the Banco de España average deposit rate, INE CPI, the 12-month Letra auction yield, and the deposit-guarantee scheme of each issuer. They show as context and never change the ranking. Funds and pension averages come later as factual catalogues. Euribor, mortgages, cards, broker and robo-advisor fees wait.

**Why.** Grok and Codex, asked separately, named the same five sets first. A script can fetch them unattended from official APIs, so they add no rows that someone must re-check by hand, and the 2026-11-05 rule still holds. Both kept Euribor out (EMMI licence), kept fee-heavy products out until the legal opinion, and refused rankings that read as investment advice. Codex put provenance and freshness enforcement first. Grok's biggest risk is a wrong official number, which people trust more than a stale offer: hence frozen series codes, saved fixtures and a writer that refuses out-of-range or empty values.

**Status.** Accepted.
