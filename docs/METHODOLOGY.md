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

## Bank apps

The [Bank apps](/apps) page ranks the mobile apps of Spanish banks. The code is `src/core/app-score.ts`. The score is about the app. It says nothing about how good a bank's offers are, and it never changes the order of offers.

Each app gets a score from 0 to 100, the sum of four parts:

1. **Rating, 60 points.** The App Store and Google Play ratings are pooled, weighted by how many people rated in each store. The result is then pulled towards 3.0 stars, as if the app had 200 more ratings of 3.0. A 5.0 from 40 people is not proof; a 4.7 from 100,000 people is. An average of 3.0 stars or less scores 0. 5.0 stars scores 60. Between them the score is linear.
2. **Freshness, 15 points.** Per store: a release in the last 30 days scores full points. A release 180 days ago or more scores 0. Between them the score is linear. The two stores are averaged. A store with no release date scores 0.
3. **Reach, 10 points.** 5 points for being on both the App Store and Google Play. Up to 5 more for the total number of ratings on a log scale: 100 ratings give 0, 100,000 or more give 5.
4. **Features, 15 points.** 3.75 points each for Bizum, Apple Pay, Google Pay and an English interface. The English interface comes from the App Store's language list. An unknown feature scores 0 and shows as "?" with a flag.

Where the numbers come from:

- **App Store:** Apple's public lookup API, for the Spanish store. It gives the average rating, the number of ratings, the date of the latest release and the interface languages.
- **Google Play:** the app's store page. The rating and the number of ratings come from the page's schema.org data; the release date is the "Updated on" line. The count is worldwide. The average is the one Google Play shows in Spain.
- **Refresh:** `npm run fetch-apps` rewrites the store numbers and moves `verified_on` to the day it ran. A store that fails to answer keeps its old numbers and the old date. Every Monday at 07:30 (Madrid) `scripts/refresh-apps.sh` runs it on the owner's Mac, opens a data-only pull request, merges it after `./check.sh` passes and redeploys the site.
- **Features:** written by hand. Each one carries a `source_url`, the page that shows it. A feature without a source stays unknown.

An app shows a "stale" badge when its store numbers are more than 30 days old. After 60 days it leaves the ranking.

Order: highest score first. A tie goes to the app with more ratings in total, then to the bank name. No paid placement exists for apps.

## Not advice

BankJar is not financial advice. Terms change. Open the source link and read the bank's page before you sign.
