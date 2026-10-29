---
name: bank-offers
description: Answer questions about Spanish bank offers with the BankJar tools: which bank pays most for a salary, where to park savings, which account a non-resident can open, how two offers compare, which bank apps rate best. Use for any question about bank bonuses, savings rates, accounts or deposits in Spain.
---

# Spanish bank offers with BankJar

BankJar ranks Spanish bank offers by first-year net value in euros. The numbers come from dated data files, never from a model. The `bankjar` MCP server (read-only, no sign-in) holds five tools.

## Steps

1. Pick the tool.
   - `search_offers`: a question or a profile in, ranked offers out. Start here.
   - `get_offer`: the full terms of one offer id.
   - `compare_offers`: two to five offer ids side by side.
   - `list_goals`: the goals that are ranked (salary, savings, account, deposit, welcome).
   - `rank_bank_apps`: bank mobile apps by store ratings, freshness, reach and payment features.
2. Ask for monthly income, balance, residency and the longest commitment the person accepts when the goal needs them and they are unknown. Do not guess them.
3. Report the ranking as the tool returned it. For each offer give the net value, the commitment, `source_url` and `verified_on`. Say the figures are estimates for the profile given.
4. If an offer has `stale=true`, say its terms may have changed. If the tool lists excluded offers, say why.
5. Close with: not financial advice, terms change, check the source page before signing.

## Limits

- Spain only. For another country, say BankJar has no offers there.
- Read-only. It opens no account, moves no money and contacts no bank.
- An app score from `rank_bank_apps` says nothing about how good a bank's offers are. Never use it to rank offers.
- Do not compute or invent a figure that a tool did not return.
