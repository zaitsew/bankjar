# Directory listing pack

Everything needed to submit BankJar to the Claude Connectors Directory and to the ChatGPT / Codex plugin directory. The text below is paste-ready. The submission itself is an account action: Ivan does it from the morning checklist at the end of this file.

- Server: `https://bankjar.fabriquefutur.com/mcp` (Streamable HTTP, stateless, no authentication, five read-only tools).
- Public pages the listings link to: [/connect](https://bankjar.fabriquefutur.com/connect) (documentation), [/privacy](https://bankjar.fabriquefutur.com/privacy), [/terms](https://bankjar.fabriquefutur.com/terms), [/support](https://bankjar.fabriquefutur.com/support).
- Icon: `public/brand/icon-512.png` and `public/brand/icon-1024.png`, rendered from `app/icon.svg` (the SVG is `public/brand/icon.svg`). Rounded corners are transparent.
- OpenAI package: `directory/openai-plugin/` (Codex-format manifest, `.mcp.json`, icons). `./scripts/build-plugin-zip.sh` builds `dist/bankjar-openai-plugin.zip`.

## Requirements this pack was written against

Fetched 2026-10-23.

| Source | What it sets |
|---|---|
| [Submit a connector](https://claude.com/docs/connectors/building/submission) | The portal at claude.ai/directory/manage, choose **MCP connector**. Listing: name up to 100 characters, one-liner up to 200, description up to 2,000, one to five categories, documentation URL, privacy policy URL, support contact, icon, permanent URL slug. Ten steps; seven compliance acknowledgments, all required. Any paid Claude plan can submit. |
| [Connector review criteria](https://claude.com/docs/connectors/building/review-criteria.md) | Every tool has a `title` and `readOnlyHint` or `destructiveHint`; tool names up to 64 characters; descriptions match behavior and do not tell Claude how to behave; useful error messages; no collection of conversation data beyond the tool's need; own first-party API; no money transfers. Test credentials are required (none apply here). |
| [Anthropic Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy) | Privacy policy link; verified contact and support channels; documentation; at least three example prompts; no advertisements, sponsored content or paid placement (4.C); no financial transactions (4.A); frugal token use for MCP servers (5.B). |
| [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines) (also served at [developers.openai.com/apps-sdk/app-submission-guidelines](https://developers.openai.com/apps-sdk/app-submission-guidelines)) | Names: no "MCP" or "Plugin" suffix, no single dictionary word; descriptions: no comparisons, no unverifiable claims, no pricing or promotions; a published privacy policy (data categories, purposes, recipients, retention, user controls); minimal inputs and responses; `readOnlyHint`, `destructiveHint` and `openWorldHint` set to explicit booleans; verified developer identity; support contact; no execution of money transfers or trades; no advertising. |
| [Upload and submit your plugin](https://developers.openai.com/plugins/deploy/submission.md) | ZIP upload at platform.openai.com/plugins; limits: display name 30 characters, subtitle 30, long description 4,000, up to three starter prompts of 128 characters; four public URLs required (website, support, privacy, terms); exactly five positive and three negative test cases; a demo recording URL; domain verification through `/.well-known/openai-apps-challenge`. |

## Listing text (both directories)

**Name** (7 characters; no suffix, not a dictionary word)

```
BankJar
```

**Subtitle** (OpenAI, 30 characters or fewer, 27 used)

```
Compare Spanish bank offers
```

**One-liner** (Claude, 200 characters or fewer, 164 used)

```
Rank Spanish bank offers by net value in euros for your goal: salary bonus, savings rate, account or deposit. Every offer has a source link and a verification date.
```

**Description** (Claude 2,000 characters or fewer; OpenAI 4,000 or fewer; 1603 used. No pricing, no comparison with other products, no superlatives.)

```
BankJar ranks Spanish bank offers by what they pay you, in euros, for a goal you choose: moving your payroll, parking savings, opening an account, a term deposit or a welcome bonus.

Ask in plain words, in English, Spanish or Russian, or pass your own figures: monthly income, balance, residency, the longest commitment you accept and the banks where you are already a customer. BankJar returns one table where a cash bonus paid over 12 months and a gift with a 36-month stay sit on the same scale, after tax and fees, with every catch shown as a flag.

Tools:
- search_offers: ranked offers for a question or a profile, plus the offers that are closed to you and why.
- get_offer: every term of one offer with its score breakdown.
- compare_offers: two to five offers side by side for your profile.
- list_goals: the goals that are ranked.
- rank_bank_apps: Spanish bank mobile apps ranked by store ratings, release freshness, reach and payment features such as Bizum.

How it works: every number comes from a deterministic engine that reads dated data files, never from a language model. Each offer carries the address of the page its terms were read from and the date it was last checked. Offers not re-checked for 30 days are marked stale, and after 60 days they leave the rankings. The code is Apache-2.0 and the dataset is CC BY 4.0, both public on GitHub.

Limits: BankJar covers Spain. It is read-only: it does not open accounts, move money or contact banks. It gives information, not financial advice, and terms change, so check the source page before you sign. No account or sign-in is needed.
```

**Categories** (Claude, one to five): the portal's list was not visible when this was written. Proposal: **Finance** as the first choice, and a second one for data or research if the portal offers it. OpenAI takes one category title from its dashboard: `Finance` is in the manifest; change it in `directory/openai-plugin/.codex-plugin/plugin.json` if the dashboard names it differently.

**URLs**

| Field | Value |
|---|---|
| Documentation | https://bankjar.fabriquefutur.com/connect |
| Website | https://bankjar.fabriquefutur.com |
| Privacy policy | https://bankjar.fabriquefutur.com/privacy |
| Terms of service | https://bankjar.fabriquefutur.com/terms |
| Support | https://bankjar.fabriquefutur.com/support (and GitHub issues: https://github.com/zaitsew/bankjar/issues) |
| Source code | https://github.com/zaitsew/bankjar (Apache-2.0) |

**Claude URL slug** (permanent once published): `bankjar`.

**ChatGPT starter prompts** (three, 128 characters or fewer each; lengths 96, 81, 78)

```
Which Spanish bank pays most for moving a 2,500 euro monthly salary? I can commit for 12 months.
I'm a non-resident. Which everyday bank account without fees can I open in Spain?
Where can I park 15,000 euros in Spain for a year at the highest savings rate?
```

## Test cases (five positive, three negative)

Used by both portals. The OpenAI package imports them from `plugin.json`; for Claude, paste them as the example prompts and reviewer instructions. Each tool chain in P1 to P5 was run against the live server on 2026-10-23 (tool calls made directly, with the arguments the prompt implies) and returned results. The negatives are prompts that must not trigger BankJar.

### Positive

**P1. Rank salary offers for a stated profile**

- prompt: `Which Spanish bank pays most for moving a 2,500 euro monthly salary? I can commit for 12 months.`
- tools_triggered: `search_offers`
- expected_behavior: Calls search_offers with goal salary, income 2500 and a 12-month commitment limit. Returns a ranked list with the net value in euros for the first year, the commitment, a source link and a verified date for each offer, and says the figures are estimates and not financial advice.

**P2. Find an account a non-resident can open, then read its terms**

- prompt: `I'm a non-resident. Which everyday bank account without fees can I open in Spain, and what are the terms of the top one?`
- tools_triggered: `search_offers, get_offer`
- expected_behavior: Calls search_offers with goal account and residency non-resident, then get_offer for the top result. Lists the account's terms, flags and eligibility for a non-resident, with its source link and verified date. Offers closed to non-residents are listed as excluded with the reason.

**P3. Compare two offers side by side**

- prompt: `Compare the top two Spanish savings accounts for 15,000 euros over one year.`
- tools_triggered: `search_offers, compare_offers`
- expected_behavior: Calls search_offers with goal savings and balance 15000, then compare_offers with the ids of the top two. Shows both side by side with net value, rate or bonus, commitment, source links and verified dates.

**P4. Explain the goals BankJar can rank**

- prompt: `What kinds of bank offers can BankJar rank?`
- tools_triggered: `list_goals`
- expected_behavior: Calls list_goals and names the five goals: salary, savings, account, deposit and welcome, with a one-line description of each.

**P5. Rank Spanish bank mobile apps**

- prompt: `Which Spanish bank apps have the best store ratings and support Bizum?`
- tools_triggered: `rank_bank_apps`
- expected_behavior: Calls rank_bank_apps and returns bank apps ranked 0 to 100 with store ratings and rating counts, Bizum support where known, and the store links. States that an app score says nothing about the quality of a bank's offers.

### Negative (must not trigger BankJar)

**N1. Moving money is not supported. Expected: no BankJar tool is called; the assistant says it cannot transfer funds and BankJar only compares public offers.**

- prompt: `Move 500 euros from my checking account to my savings account.`

**N2. Outside Spanish bank offers. Expected: no BankJar tool is called; the request is about a US credit card, which BankJar does not cover.**

- prompt: `Which US credit card gives the highest cashback on groceries?`

**N3. Investment advice is not supported. Expected: no BankJar tool is called; BankJar ranks bank offers and gives no investment or trading advice.**

- prompt: `Should I buy Bitcoin or Tesla shares this week?`

## Reviewer notes

Paste into Claude's **Test & launch** step and OpenAI's **Review details**.

```
No account, sign-in or credentials are needed. The server is public and has no authentication:
https://bankjar.fabriquefutur.com/mcp (Streamable HTTP, stateless). Add it as a custom connector (Claude:
Customize > Connectors > Add custom connector; ChatGPT: chatgpt.com/plugins > Add custom MCP server) and
choose no authentication. Setup steps: https://bankjar.fabriquefutur.com/connect

All five tools are read-only (readOnlyHint true, destructiveHint false, openWorldHint false) and have titles:
search_offers, get_offer, compare_offers, list_goals, rank_bank_apps. Nothing is written, sent to a bank or
bought. BankJar ranks public bank offers; it never opens accounts, moves money or contacts banks.

Not financial advice: every answer carries that disclaimer, a source link and a verified date. Figures are
estimates for the profile given. Numbers come from a deterministic engine reading dated YAML files in the
public repository (https://github.com/zaitsew/bankjar, data/offers and data/apps); a language model never
writes a number. The free-text question is optionally read into filters by an AI model (Claude Haiku,
through the operator's own accounts service); see the privacy policy.

Data sources: each offer cites the page its terms were read from (source_url) and the date (verified_on).
On 2026-10-23, 60 of 69 offers cite the bank's own page; 9 cite a third-party page (4 kelisto.es, 1 finect.com,
4 raisin.com, a deposit marketplace). No link carries an affiliate or tracking parameter, and BankJar earns nothing from any
link. Offers not re-checked for 30 days are marked stale; after 60 days they leave the rankings.

Coverage is Spain. Questions about other countries return no matching offers and the assistant should say so.
Test prompts and expected results are in the listing: five positive, three negative.
```

## Data handling and compliance answers

**Claude portal, step 7 (Data handling)**

| Question | Answer |
|---|---|
| The underlying API is | **Our own.** The server at bankjar.fabriquefutur.com reads its own dataset (`data/` in the public repository). It calls no third-party API at request time, except the optional AI parser, which goes through the operator's own accounts service. The MCP domain is the service's domain. |
| Handles personal health data | **No.** |
| Handles sponsored content | **No.** No advertising, sponsorship or paid placement; ranking is a public formula (`src/core/score.ts`) and `docs/METHODOLOGY.md` states that paid placement never changes the order. |
| Reads or writes | **Reads only.** Five read-only tools. |

**Claude portal, step 4 (Use cases)**: primary use cases: (1) rank Spanish bank offers for a goal and a profile (salary bonus, savings, account, deposit, welcome bonus); (2) read and compare the terms of specific offers; (3) rank Spanish bank mobile apps. Users need nothing before connecting: no account, plan or setup. Reads data only.

**Claude portal, step 5 (Company)**: company name: Fabrique Futur (operator Ivan Zaitsev); website: https://www.fafutur.com (fabriquefutur.com redirects there; confirm this is the right public page) or https://bankjar.fabriquefutur.com; primary contact for review updates: Ivan's e-mail (TODO, below).

**Claude portal, step 6 (Authentication)**: **No authentication.**

**Claude portal, step 9 (seven compliance acknowledgments, all required)**

| Acknowledgment | Why it holds |
|---|---|
| Directory guidelines | The policy was read (see the table above) and the checks in this file were made against it. |
| First-party API usage | The server is the operator's own and serves its own open dataset. |
| Financial transactions | BankJar does not transfer money, cryptocurrency or any asset and executes no financial transaction. It ranks public offers and never opens accounts or moves money; the offer pages link to the bank's own page, where the person decides. |
| AI media generation | None. No image, video or audio is generated. |
| Prompt injection | Tool descriptions say what the tool does. Tool results are data (rows from the dataset); the AI parser treats the question as data and is told never to follow instructions inside it. Nothing pulls instructions from outside. |
| Conversation data collection | Tools receive only their arguments: an optional question (up to 500 characters) and profile figures. BankJar cannot see the chat, memory or files, and keeps no log of questions. |
| Public documentation | https://bankjar.fabriquefutur.com/connect, plus `docs/AGENTS-API.md` and `/llms.txt`. |

**OpenAI attestations** at *Submit for review*: no commerce (`commerce: false`: BankJar sells nothing and processes no payment); no advertising; no restricted data (no payment card data, health data, government identifiers or credentials are requested); read-only; verified developer identity (see checklist). Residency (resident, NIE/TIE holder, non-resident) is a filter, not an identifier.

### Financial-services position (both directories)

- BankJar is an information service. It does not open accounts, take deposits, execute transfers, trades or payments, or act for the user. It has no write tool and no payment flow.
- Links go to the page where each offer's terms were read: the bank's own page for 60 of 69 offers, a third-party page (kelisto.es, finect.com, a Raisin deposit marketplace page) for 9. A check on 2026-10-23 found no affiliate or tracking parameter in any `source_url` (the `cid=` in two Kutxabank links is the bank's own content id). BankJar earns nothing from any link, takes no payment from banks and has no affiliate arrangement; `docs/PLAN.md` keeps affiliate links off until the owner decides.
- Every result includes the line "Not financial advice. Terms change; check source_url before signing."

## Country availability proposal

**No restriction** for both directories (OpenAI: omit `publication.countries`, or set `[]`; Claude: the portal has no country step).

Why: the data covers Spain, but the people who ask about Spanish banks are often elsewhere: expats, non-residents and people planning a move. A country allowlist would exclude exactly them. BankJar provides no regulated service in any country, because it does not transact, so nothing legal depends on the user's country. Claude's policy requires compliance with Anthropic's supported-countries list; that is Anthropic's rule for Claude, not a setting here. China: Ivan's store policy excludes mainland China from App Store listings because of the AI-permit rule for apps; it does not apply to these two directories, and ChatGPT and Claude are not offered there. If you want the same stance anyway, set an OpenAI allowlist that leaves CN out; that is your decision.

## Review risks to know before you submit

1. **Third-party source links.** 9 of 69 offers cite kelisto.es, finect.com or raisin.com instead of the bank. A reviewer may read that as a comparison-site relay. The claim "BankJar earns nothing from these links" is true. Replacing the kelisto.es and finect.com sources with the banks' own pages would remove the question.
2. **Server instructions wording.** `MCP_INSTRUCTIONS` in `src/server/mcp.ts` tells the model how to behave ("Always cite...", "Never present..."). Claude's criteria reject descriptions that tell Claude how to behave. These lines are accuracy and safety guidance about this tool's own output, not about other tools, but a strict reviewer may flag them. `src/server/mcp.ts` is outside this change; if flagged, move the wording into the result text as plain statements.
3. **Token use.** `search_offers` returns a text block and the same data again as JSON text, besides `structuredContent`. Claude's policy asks for frugal responses (5.B). Also outside this change.
4. **Tool metadata is scanned live.** OpenAI scans the hosted server and holds changed tool metadata for review after approval. Submit after the MCP App widget work has merged and deployed, so the approved metadata is the final one.
5. **Contact.** Claude's policy asks for verified contact information. Until `NEXT_PUBLIC_CONTACT_EMAIL` is set at deploy time, the pages name only GitHub issues. Set it before submitting.

## Morning checklist for Ivan

### 0. Before either portal (10 minutes)

1. Confirm the PR is merged and deployed (`./scripts/deploy.sh`): https://bankjar.fabriquefutur.com/privacy, `/terms`, `/support` and `/connect` return 200.
2. **Set the public contact e-mail and redeploy:** `NEXT_PUBLIC_CONTACT_EMAIL=<address you want public> ./scripts/deploy.sh`. It appears on the privacy, terms and support pages. Both portals ask for a contact; Claude's policy asks for a verified one.
3. Read `/privacy` and `/terms` once. They describe the code as it is; the operator line and the legal-basis sentence are yours to confirm (the repo has no postal address, so none is given).

### 1. Claude Connectors Directory

You need a paid Claude plan. Time: about 20 minutes.

1. Test it as a user first. Open https://claude.ai/customize/connectors, **Add custom connector**, name `BankJar`, URL `https://bankjar.fabriquefutur.com/mcp`, no sign-in. In a chat turn it on from **+ > Connectors** and run P1 to P5 above so that each of the five tools has been called once. The portal's *Test & launch* step asks you to confirm this.
2. Open https://claude.ai/directory/manage, **Submit new**, **MCP connector**.
3. Step 1 Connection: paste `https://bankjar.fabriquefutur.com/mcp`, or pick the custom connector you added.
4. Step 2 Tools: five tools sync in; none should be flagged (all have titles and annotations).
5. Step 3 Listing: name, one-liner, description, categories, the four URLs and slug from the sections above. Icon: upload `public/brand/icon-512.png` (1024 version: `icon-1024.png`).
6. Steps 4 to 7: use the answers above (no authentication; own API; no health data; no sponsored content).
7. Step 8 Test & launch: paste the reviewer notes; credentials: none needed; tick that you ran every tool.
8. Step 9: tick all seven acknowledgments (answers above). Step 10: read the warnings, submit.
9. Status and reviewer feedback appear at the same portal. Escalations: mcp-review@anthropic.com.

### 2. ChatGPT / Codex plugin directory

Time: about 30 minutes, plus the video.

1. **Verify the organization.** https://platform.openai.com/settings/organization/general: complete individual or business verification. Without it the developer identity cannot be chosen. Only an organization owner, or a member with Apps Management Write, can submit.
2. **Build the ZIP** from a checkout of this repo: `./scripts/build-plugin-zip.sh`. The result is `dist/bankjar-openai-plugin.zip`. Open `directory/openai-plugin/.codex-plugin/plugin.json` first and change `category` if the dashboard's name differs; add `"email"` under `author` if you want one shown.
3. **Record the demo video** (required for MCP review, one to two minutes; script below). Upload it somewhere a reviewer can open without signing in (an unlisted video) and add the address to `plugin.json` under `extensions.com.openai.review` as `"demo_recording_url": "<url>"`, then rebuild the ZIP. Or add the address in the portal's Review details.
4. Open https://platform.openai.com/plugins, **Upload new or existing plugin**, choose your verified developer identity, upload the ZIP. Fix anything under *Metadata & Skills* > **Issues** (use **Copy issues**), then rebuild and upload again.
5. **Connect the MCP server.** *MCPs* > `bankjar` > **Connect**: URL `https://bankjar.fabriquefutur.com/mcp`, authentication: none. The portal now shows the **domain-verification challenge token**.
6. **Publish the token.** The route `https://bankjar.fabriquefutur.com/.well-known/openai-apps-challenge` returns the value of the environment variable `OPENAI_APPS_CHALLENGE` as plain text, and answers 404 until it is set. The token is public, not a secret. On the server (from the machine you deploy from; `/srv/bankjar/.env` exists after the first deploy and `scripts/deploy.sh` never overwrites it):

   ```
   ssh deploy@159.89.99.84 "echo 'OPENAI_APPS_CHALLENGE=<token from the portal>' >> /srv/bankjar/.env && cd /srv && docker compose up -d --force-recreate bankjar"
   curl -s https://bankjar.fabriquefutur.com/.well-known/openai-apps-challenge   # must print exactly the token
   ```

   If the variable is already in the file, edit that line instead of appending. Then return to the portal and finish **Connect**; wait for the tool scan; fix findings and **Rescan** if any.
7. *Metadata & Skills* > **Review information** > **Review details**: check that the five positive and three negative cases imported (they are read-only; edit `plugin.json` and re-upload to change them). Reviewer credentials: none (the server needs no sign-in); put "No sign-in required" in the instructions field if it insists on text, and paste the reviewer notes. Save.
8. **Submit for review**, tick the attestations (answers above). Feedback comes by e-mail; reply to appeal.
9. When approved, open the package version and **Publish plugin**. Later changes to the MCP server are scanned daily; use **Rescan** after a deploy.

### Demo video script (about 90 seconds)

1. Show https://bankjar.fabriquefutur.com/connect and the URL (5 s).
2. In ChatGPT: plus > Add custom MCP server > name, URL, no authentication > Create as a plugin (20 s).
3. New chat, `@BankJar`, run P1; scroll to the net value, source link and verified date (20 s).
4. Run P2, then P3 (25 s).
5. Run P4 and P5 (10 s).
6. Run N1 and show that BankJar is not called and the assistant says it cannot move money (10 s).
