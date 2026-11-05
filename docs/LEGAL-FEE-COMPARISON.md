# Is BankJar a "fee comparison website" under Spanish law?

Written 2026-11-05. This is a screening note, not legal advice and not a conclusion.
Nothing has been filed and Banco de España has not been contacted.

## Answer

**Open.** The text reads broadly enough that BankJar's `goal: account` feature may be in scope,
and the site has none of the paperwork the rule asks for. Two facts point the other way: BankJar
compares one monthly fee, not the Annex 1 service fees, and it ranks by bonus value.
A Spanish financial-regulation lawyer should decide. The question to put is at the end.

## The rule (read at the source, BOE text of 2026-11-05)

| Source | What it says | Where |
|---|---|---|
| Real Decreto-ley 19/2017, art. 19.1 | Operators other than Banco de España "que deseen establecer un sitio web que permita comparar las comisiones que aplican los proveedores de servicios de pago" must file a *declaración responsable* before starting. | [BOE-A-2017-13644](https://www.boe.es/buscar/act.php?id=BOE-A-2017-13644) |
| RDL 19/2017, art. 19.2 | "En todo caso, todos los sitios web de comparación deberán" meet items a–g: independence, owners shown, clear criteria, plain language and standard terms, update time, broad coverage with a statement when incomplete, an error-report procedure. | same |
| Orden ECE/228/2019, art. 2.3 and art. 13 | Chapter IV applies to "toda persona física o jurídica" that sets up such a site. Art. 13.1 adds written policies, no order driven only by commercial interests, remuneration never the main reason a product ranks, an «Anuncio» box in red letters before any advertised product, and clear, non-misleading advertising. | [BOE-A-2019-3113](https://www.boe.es/diario_boe/txt.php?id=BOE-A-2019-3113) |
| Circular 2/2019 (Banco de España), Norma 2.2, 10, 11 and Annex 3 | Norma 10: file the Annex 3 form electronically before starting, and file again "a la mayor brevedad posible" if owner or contact data change. Norma 11: keep an internal-procedures manual available to Banco de España. Annex 3 repeats items a–m as sworn commitments. | [BOE-A-2019-4955](https://www.boe.es/eli/es/cir/2019/03/29/2/con) |

Scope words that matter:

- The trigger is a site that lets users **compare the fees** payment service providers charge for
  **services associated with payment accounts**. Deposits and bonuses are not named.
- Art. 13.1 applies to such a site "se comparen asociados a otros productos financieros o no".
  A site that mixes fee comparison with bonuses does not leave scope on that ground alone.
- I found no exception for free sites, small sites, non-commercial sites, or sites with no ads.
  I did not search beyond the three instruments above.

## What BankJar does today

- 17 offers have `goal: account` (16 banks), each with `fees.monthly_eur`. Fifteen show 0; Cajamar
  shows 20 and Mediolanum 5. `fees.notes` carries free text on cards, transfers and ATMs.
- The goal is described as "Current accounts with no fees or with fees waived"
  (`src/server/api.ts`). Its example question is "Free bank account for a non-resident".
- The compare page has a **Monthly fee** row (`app/compare/page.tsx:80`). The MCP widget shows a
  "/month fee" chip (`src/server/mcp-widget.ts:296`).
- Ranking is by first-year net value, which subtracts 12 × `monthly_eur` (`src/core/score.ts:156`).
- The other fields: 14 `salary` offers (all fee 0), 20 `savings` (1 with a fee), 15 `deposit`
  (1 with a fee), 3 `welcome`. Salary accounts (*cuenta nómina*) are probably payment accounts;
  savings and deposits probably are not. A lawyer should confirm both guesses.
- `paid_placement` exists in the schema, defaults to `false`, and is `false` in all 69 offers.
  It only adds the text flag "paid placement" (`src/core/score.ts:172`) and never changes order.
  Terms §2 and §7 say no bank pays for ranking and no affiliate code is added.
- The operator is named on `/terms`. The AI search went live
  around 2026-10-22 (`docs/ROADMAP.md`). The site has been public for about two weeks.
- The repo mentions none of RDL 19/2017, Orden ECE/228/2019 or Circular 2/2019.

## Which parts appear to apply, if BankJar is in scope

| Requirement | Status on the site |
|---|---|
| Declaración responsable before starting (Norma 10) | Not filed. If in scope, the site started without it. |
| Independence, equal treatment (19.2.a, Annex 3 a, i, j) | Looks met: no paid placement, one open formula. |
| Owners shown (19.2.b) | On `/terms` only. Not checked on every page. |
| Clear criteria (19.2.c) | Met: `/methodology` and open code. |
| Plain language and Annex 1 standard terms (19.2.d) | **Gap.** Fee labels are free text, not the Banco de España list. |
| Accurate, dated information (19.2.e) | Met: `verified_on` per offer, stale after 30 days, hidden after 60. |
| Broad coverage and a pre-results "not the full market" statement (19.2.f) | **Gap.** 16 banks, and no such statement. The only notice is "Not financial advice". |
| Error-report procedure (19.2.g) | Met: `/support`. |
| Written policies on selection, remuneration, fee guarantee, update frequency (art. 13.1.a) | **Partial.** Methodology and terms cover selection and remuneration. No statement on whether fees are guaranteed or on update frequency for offers. |
| Internal-procedures manual (Norma 11) | **Gap.** None. |
| «Anuncio» label, clear advertising (art. 13.1.d–e, Annex 3 k–l) | Not triggered while there is no advertising. The `paid_placement` flag text would **not** satisfy the label if it were ever used. |

## Which parts appear not to apply, or are doubtful

- **What is compared.** BankJar ranks bonus value net of one fee. It does not compare the Annex 1
  service fees (cards, transfers, ATM, overdraft) side by side. This is the strongest argument
  against scope. The counter-argument is the "Monthly fee" row and the free-account goal, which
  are a fee comparison in plain terms.
- **Which products.** Savings accounts and term deposits are probably not payment accounts.
  The salary and account goals probably are.
- **Form of the service.** The rule says *sitio web*. BankJar is also an API and an MCP server that
  return the same rows. Whether those count is a question for the lawyer.

## What would change on the site if it applies

1. File Annex 3 with Banco de España (owner or lawyer, not an agent), then refile on any change.
2. Add a statement before the results of every account ranking: the data covers 16 banks and is not
   the whole market. Mirror it in the API `disclaimer` and the MCP instructions.
3. Relabel account fees with the Annex 1 terms, or link each fee to them.
4. Write the policy page (selection, remuneration, fee guarantee, update frequency) and the
   internal-procedures manual. Put the manual in `docs/`, not on the site.
5. Show the owner in the footer of every page.
6. Before any paid placement exists: build the red «Anuncio» box and make the schema refuse
   `paid_placement: true` without it.
7. Alternative to 1–6: remove fees from the account goal (the Monthly fee row, the chip, the fee
   term in ranking) so the site compares bonuses only. This is a product change, and a lawyer
   should say whether it would take the site out of scope or only look like it.

## Not verified

- Only the original text of the Orden was read. Later amendments to art. 13 were not checked.
- No Banco de España guidance, FAQ or list of registered comparison sites was read.
- The sanction regime was not researched. The Orden's first additional provision calls its rules
  *normas de ordenación y disciplina*.
- Whether a legal entity or a natural person operates the site is not stated in the repo. The
  `/terms` line names a person with a company name in brackets.

## The question for the lawyer

> BankJar (bankjar.fabriquefutur.com) is a free website, JSON API and MCP server operated by
> [operator as named on /terms; fill in and confirm the legal operator before sending]. It has been public since about
> 2026-10-22 and takes no money from banks. For 17 current-account offers from 16 banks it shows
> a monthly maintenance fee, free-text notes on card and transfer fees, and a ranking by first-year
> net value that subtracts that fee. It also ranks salary-bonus, savings and deposit offers.
>
> Does this make BankJar a "sitio web que permita comparar las comisiones" under art. 19 RDL
> 19/2017, arts. 2.3 and 13 Orden ECE/228/2019 and Norma 2.2 and 10 Circular 2/2019, so that a
> declaración responsable had to be filed before it started? If yes: what is the exposure for the
> weeks it has run without one, and what is the lightest way to comply? If no: which design limits
> keep it outside (for example, no fee row for accounts), and do the API and MCP outputs change
> the answer?
