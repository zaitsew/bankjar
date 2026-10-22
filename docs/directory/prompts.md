# Directory screenshots: prompts

Carousel screenshots for the Claude Connectors Directory (MCP App listing). Spec: PNG, at least 1000 px wide,
3 to 5 images, cropped to the app response only, prompt text supplied separately (this file).

Each image is the offer-cards widget rendered in a local harness with real BankJar data and a sandboxed
iframe, speaking the MCP Apps bridge as a host does. These are not captures from inside Claude or ChatGPT.
Dated 2026-10-23; offer figures change with the data.

| # | File | Prompt | Tool call | Look |
|---|------|--------|-----------|------|
| 1 | `screenshots/01-salary-top-offers.png` | What is the best salary-account bonus in Spain if I earn 2,500 euros a month? | `search_offers` (`monthly_income_eur: 2500`) | light, 720 px column @2x |
| 2 | `screenshots/02-savings-no-lock-in.png` | Where can I park 15,000 euros for a year with no lock-in and earn the most? | `search_offers` (`balance_eur: 15000`, `max_commitment_months: 0`) | light, 720 px @2x |
| 3 | `screenshots/03-compare-three.png` | Compare the top three of those side by side for me. | `compare_offers` (top three ids of #1) | dark, 720 px @2x |
| 4 | `screenshots/04-compare-not-eligible.png` | Compare the same three if I earn 300 euros a month and live outside Spain. | `compare_offers` (`monthly_income_eur: 300`, `residency: non_resident`) | light, 720 px @2x |
| 5 | `screenshots/05-welcome-phone-dark.png` | Which bank gives the best welcome bonus for new customers? | `search_offers` (`goal: welcome`) | dark, 390 px phone width @3x |

## Regenerate

```sh
npx tsx scripts/widget-harness.ts                # writes runs/widget-harness/index.html (gitignored)
B=~/.claude/skills/gstack/browse/dist/browse     # gstack browse; Playwright works the same way
U="file://$PWD/runs/widget-harness/index.html"
$B viewport 800x900 --scale 2
$B goto "$U?s=salary&theme=light&w=720&chrome=0"
$B screenshot docs/directory/screenshots/01-salary-top-offers.png --selector '#f'
```

Query: `s` = salary, savings, account, welcome, compare, compare-excluded; `theme` = light or dark; `w` = column width in px;
`chrome=0` hides the log line; `mutate=stale` marks the first row stale and the last negative (visual check only, never shipped).
