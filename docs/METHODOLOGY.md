# Methodology

BankJar puts every reward on one scale: euros you keep.
The code is `src/core/score.ts`. This page says the same thing in words. If they disagree, the code is wrong or this page is; open an issue.

## Two numbers per offer

- **Net value (first year).** What the offer is worth in your pocket in year one, after tax and fees.
- **Value per month.** The net reward minus fees over the commitment, divided by the commitment months. Shown only when the offer has a commitment.

## The rules

1. **Cash.** Net = value × (1 − 0.19). Spanish banks withhold 19% on bonuses.
   A bonus paid out over more than 12 months counts only its first 12 months in the first-year net value: €840 over 24 months counts €420 gross. Value per month counts all of it.
2. **Gifts.** Net = value × gift factor − 0.19 × value.
   The gift factor is what the gift is worth to you. The default is 0.8. You can change it.
   The 19% is tax on payment in kind, charged on the retail value. We always charge it and flag "tax on gift: check terms", because the data does not say whether the bank pays it.
3. **Fee waivers.** A saved fee counts at face value. It is not income, so it carries no tax.
4. **Interest.** Interest = min(your balance, the balance cap) × TAE × min(promo months, 12) ÷ 12, then minus 19%.
   Your balance defaults to €10,000. It counts for rate offers and for any savings or deposit offer that shows a rate.
5. **Fees.** Net value subtracts 12 months of the monthly fee.
   Value per month subtracts the monthly fee × the commitment months, with a floor of 12 months.
6. **Value per month** = (reward and interest after tax − fees over the commitment) ÷ commitment months.
7. **Flags.** A penalty, a paid placement, an unknown value or a missing income shows as a flag. A flag never changes a number.

Amounts are rounded to cents at the end.

## Who sees which offer

An offer is left out of your ranking, with the reason shown, when:

- you earn less than its minimum income;
- it is for new customers and you already bank there;
- it is for residents only and you are a non-resident, or it refuses a NIE or TIE and you have one;
- its commitment is longer than the longest one you accept;
- it is a gift and you asked for cash only;
- it has expired, or we have not verified it for more than 60 days.

If we do not know a fact about you (income, residency), we do not exclude. We flag it.

## Freshness

Every offer has a `verified_on` date and a source link.
After 30 days the offer shows a "stale" badge. After 60 days, or after its `valid_until` date, it leaves the rankings.

## Order

Highest net value first. A tie goes to the higher value per month (no commitment ranks last), then to the newer `verified_on`, then to the offer id.
Paid placement never changes the order.

## Worked example

Two offers. The person is a resident with default settings (gift factor 0.8, no fees).

| | Bank A | Bank B |
|---|---|---|
| Reward | €800 cash | €1,500 phone |
| Commitment | 12 months | 36 months |

**Bank A.** Withholding is 800 × 0.19 = €152. Net value is 800 − 152 = **€648**.
Value per month is 648 ÷ 12 = **€54.00**.

**Bank B.** The phone counts as 1,500 × 0.8 = €1,200. Tax is 1,500 × 0.19 = €285. Net value is 1,200 − 285 = **€915**.
Value per month is 915 ÷ 36 = **€25.42**.

Bank B pays more in total. Bank A pays more than twice as much per month of commitment.
BankJar sorts by net value, so B comes first, and the table shows both columns so you can choose.

With a €5 monthly fee on Bank B, net value drops by 5 × 12 = €60, to €855.
Value per month drops by 5 × 36 ÷ 36 = €5, to €20.42.

## Not advice

BankJar is not financial advice. Terms change. Open the source link and read the bank's page before you sign.
