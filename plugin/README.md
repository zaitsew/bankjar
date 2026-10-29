# BankJar for Claude

BankJar ranks Spanish bank offers by what they pay you, in euros, for a goal you choose: moving your payroll, parking savings, opening an account, a term deposit or a welcome bonus. Ask in plain words or pass your own figures. Every offer carries the page its terms were read from and the date it was last checked.

## Install

```sh
/plugin install bankjar --marketplace zaitsew/bankjar
```

The plugin adds one skill, `bank-offers`, and connects the public BankJar server at `https://bankjar.fabriquefutur.com/mcp`. No account, sign-in or key is needed.

## Try it

- Which Spanish bank pays most for moving a 2,500 euro monthly salary? I can commit for 12 months.
- I'm a non-resident. Which everyday bank account without fees can I open in Spain?
- Which Spanish bank apps have the best store ratings and support Bizum?

## Tools

All five tools are read-only.

- `search_offers`: ranked offers for a question or a profile, plus the offers closed to you and why.
- `get_offer`: every term of one offer with its score breakdown.
- `compare_offers`: two to five offers side by side for your profile.
- `list_goals`: the goals that are ranked.
- `rank_bank_apps`: Spanish bank mobile apps ranked by store ratings, release freshness, reach and payment features.

## Privacy

The plugin contains no hooks, scripts or code. It declares one remote MCP server, run by the maintainer, and one skill that tells Claude how to present the results. A tool call sends the server its arguments: an optional question of up to 500 characters and profile figures such as income and balance. The server cannot see your conversation, memory or files, and keeps no log of questions. When the rule parser cannot place a question, its text goes through the operator's accounts service to an AI model; send filters instead of a sentence to skip that step. Full policy: https://bankjar.fabriquefutur.com/privacy. Deleting your data: https://bankjar.fabriquefutur.com/data-deletion.

## Limits

BankJar covers Spain. It gives information, not financial advice, and terms change, so check the source page before you sign. It opens no account and moves no money.

## Links

- Documentation: https://bankjar.fabriquefutur.com/connect
- Support: https://bankjar.fabriquefutur.com/support or https://github.com/zaitsew/bankjar/issues
- Source: https://github.com/zaitsew/bankjar (code Apache-2.0, data CC BY 4.0)
