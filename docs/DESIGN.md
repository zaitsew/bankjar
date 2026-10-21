# Design: BankJar

This is the product's own design system. It follows the shared standard in Teyla's
`templates/design/STANDARD.md` and fills in what is specific here.

The owner's brief for the look: "It should be similar to https://arena.ai/" (docs/BRIEF.md).
arena.ai is a near-black page, a thin icon rail, a serif headline with one highlighted word, a large
prompt box, a mode switch and a grid of example cards. Its leaderboard is a dense ranked table.
BankJar copies that structure and puts bank offers in it.

## Tokens

Where they live: `app/globals.css`, in `:root` (variant A, dark), a `prefers-color-scheme: light`
block, and a `:root[data-variant="b"]` block (variant B). Tailwind utilities read the same names
through `@theme inline` (`bg-surface`, `text-muted`, `border-line`). Views use these names only.
`app/icon.svg` is the one file with colour literals; an icon cannot read CSS variables.

| Token | Name in code | Value |
|---|---|---|
| Type: display / title / body / caption | `--text-display`, `--text-title`, `--text-body`, `--text-caption` (classes `t-display`, `t-title`, `t-body`, `t-caption`) | display clamp(2.5rem, 6.4vw, 4.25rem) serif; title 1.75rem serif; body 1rem on phones, 0.9375rem from 768 px; caption 0.8125rem |
| Fonts | `--font-ui`, `--font-serif` | system sans stack; Instrument Serif (next/font/google) with Georgia fallback |
| Colour roles | `--bg`, `--surface`, `--surface-2`, `--line`, `--line-strong`, `--text`, `--text-2`, `--accent`, `--accent-ink`, `--accent-text`, `--ring`, `--good`, `--warn`, `--danger`, `--info` | dark: bg #0b0b0c, surface #141416, text #f4f1ea, accent jar-gold #f2c14e. Light: bg #fbfaf7, text #16150f, accent text #7a5600 |
| Bank avatars | `--av-0` to `--av-7`, `--av-ink` | eight pastel fills with one dark ink, picked by a hash of the bank slug. No logos |
| Spacing | Tailwind scale (4 px base) | 1, 2, 3, 4, 6, 8 ... steps. No arbitrary values except the hero's top offset |
| Radius, motion | `--r-sm`, `--r-md`, `--r-lg`, `--r-pill`, `--ease` | 0.5, 0.875, 1.25 rem, pill, 140 ms |

Type rule: a screen uses at most three sizes. Home: display, body, caption. Every other screen:
title, body, caption. Hierarchy comes from weight and colour first.

Contrast: body text, muted text (`--text-2`) and badge colours are at least 4.5:1 on their surface in
all three themes. Focus uses `--ring` (3:1 or better). Colour is never the only signal: stale rows carry
a "Stale" badge, best values in the grid carry a "Best" label.

## Voice (register b)

UI copy only. Social and marketing text follows the voice chart.
- The product sounds: plain, exact, a little dry.
- Address: "you". English only in this release. Spanish and Russian questions are understood by the parser.
- Glossary, one word per thing, never rotated:
  - **offer** (not deal, promo, product) is one bank proposal with a reward and terms.
  - **goal** is what the person wants to do: salary, savings, free account, deposit, welcome bonus.
  - **net value** is the first-year value in euros after tax and fees. **Value per month** is net value per month of commitment.
  - **commitment** (not lock-in, permanence) is how long the person must keep the product.
  - **catches** are flags and penalties shown next to a number. **Left out** is an offer that does not fit the person's filters.
  - **verified** is the date a person or the verifier last read the source page. **Stale** means more than 30 days old.
  - **leaderboard** is a ranked table per goal. **Side by side** is the comparison grid.
- Buttons: verb plus object, at most 3 words. No "Please". No "!". Used: Find offers, Compare selected, Apply filters, Reset filters, Try again, Copy.
- Errors: what happened, then what to do.
- Numbers instead of adjectives: "5 days ago", not "recently".

## Screen inventory

| Screen | Job (one sentence) | Primary action | Empty / loading / error | Last reviewed on device |
|---|---|---|---|---|
| Home `/` | Turn a question into a ranked table in one step. | Find offers | yes / n/a (static data) / yes | not yet |
| Search `/search` | Show the ranked table for the parsed intent and let the person adjust it. | Compare selected | yes / yes (skeleton) / yes | not yet |
| Leaderboards `/leaderboard` | Show the top three of every goal. | Open a goal | yes / n/a / yes | not yet |
| Goal board `/leaderboard/[goal]` | Rank every offer of one goal for a default profile. | Compare selected | yes / n/a / yes | not yet |
| Offer `/offer/[id]` | Show every term, the score breakdown and the source of one offer. | Open the source | n/a / n/a / yes (404) | not yet |
| Side by side `/compare` | Put two or three offers in one grid, best value marked. | Compare selected (picker) | yes / n/a / yes | not yet |
| Methodology `/methodology` | Explain the ranking rules in words. | Read | n/a / n/a / yes | not yet |
| For agents `/agents` | List the endpoints and copyable examples. | Copy | n/a / n/a / yes | not yet |

## Layout

- **Desktop (768 px and up):** a 64 px icon rail on the left (Search, Leaderboards, Side by side, For agents,
  Methodology) with tooltips on hover and focus. **Phone:** a top bar with the logo and the same five icons.
  Tap targets are 44 px.
- **Tables** keep real `<table>` markup. When the container is narrower than 62 rem (`full`) or 40 rem
  (`board`, `mini`), rows become stacked cards via a container query, so a 375 px phone reads cards and a
  1280 px laptop reads the table. Each cell carries a `data-label` for the card.
- **Client JavaScript** is limited to four small islands: the nav's active state, the compare checkboxes
  (the form also works without JavaScript), the layout switch and the copy buttons. Everything else is server-rendered.

## Two variants (owner review, standard Part 4)

Switch with `?v=a` or `?v=b`, or with "Layout: Arena / Ledger" in the footer. The choice is saved in a cookie
(`bj_v`) and applies to every page. Home and results differ in structure, not only in colour.

| | A: Arena (default) | B: Ledger |
|---|---|---|
| Look | Near-black, light by system setting, rounded cards, one gold accent | Warm paper, serif numerals, hairline rules, always light |
| Navigation | Left icon rail | Top masthead with text labels |
| Home | Centred headline, pill-shaped prompt box, pill mode switch, 3 by 2 card grid | Left-aligned headline, ruled one-line prompt, text mode tabs, numbered ruled list of examples |
| Results | Boxed table, bank avatars, sticky pill compare bar | Open ledger: no box, no avatars, serif rank and net value, rules instead of cards |

Cut list for the owner (choose, then the loser is deleted):
- Variant B removes: the rail, bank avatars, card boxes, the pill mode switch, table borders and zebra hover tint.
- Variant A removes nothing from the default; it is the arena.ai structure.
- Both: no logos, no sponsored slots, no streaks, no promo banners.
- Not built, on purpose: dark ledger, a third variant, per-user theme settings.

If neither variant is accepted, the owner's comments go in one round; only accepted cuts are applied.

## Deliberately absent

- No bank logos. They are trademarks and add nothing the name does not say.
- No sponsored rows, "best for you" badges or affiliate buttons. Paid placement never changes the order (docs/PLAN.md).
- No account, no sign-in, no cookies except the layout choice (`bj_v`), so no consent banner is needed.
- No client-side ranking. The server runs the same `search()` for the page, the API and MCP.
- No AI-written numbers. The table is data; the summary sentence is a template.
- No settings screen. Filters live next to the results they change.
- No streaks, badges or notifications. The product should not pull people back.

## Platforms

Primary: web (responsive). Phone and desktop browsers are both first-class; there is no native app.
The rail collapses to a top bar below 768 px. Mac and iOS apps are not planned.

## `teyla ux check`

Run in the worktree. Colour and font-size literals appear only inside `--token` definitions in
`app/globals.css`, which the check treats as tokens. Views contain none. Exceptions noted: `app/icon.svg`
holds hex colours because a favicon cannot read CSS variables; the check does not scan SVG files.
