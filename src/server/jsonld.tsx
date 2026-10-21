import type { Offer } from "../core/schema";
import type { Score } from "../core/score";
import { offerUrl } from "./api";

/**
 * schema.org markup for an offer page. `offerJsonLd` is pure; `<JsonLd>` renders the
 * <script type="application/ld+json"> tag. Only facts from the data file go in: the
 * terms, the dates and the source. The one BankJar-computed figure, net value, is
 * labelled as such in additionalProperty.
 */

type JsonLdObject = Record<string, unknown>;

function schemaType(goal: Offer["goal"]): "BankAccount" | "DepositAccount" | "FinancialProduct" {
  switch (goal) {
    case "savings":
    case "deposit":
      return "DepositAccount";
    case "account":
    case "salary":
      return "BankAccount";
    default:
      return "FinancialProduct";
  }
}

function feesText(offer: Offer): string {
  const f = offer.fees;
  const monthly = f.monthly_eur === null ? "Monthly fee not stated." : f.monthly_eur === 0 ? "No monthly fee." : `Monthly fee: EUR ${f.monthly_eur}.`;
  return [monthly, f.notes, offer.penalty ? `Penalty: ${offer.penalty}` : null].filter(Boolean).join(" ");
}

export function offerJsonLd(offer: Offer, score: Score): JsonLdObject {
  const data: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": schemaType(offer.goal),
    "@id": `${offerUrl(offer.id)}#product`,
    name: offer.product_name,
    description: offer.headline,
    url: offerUrl(offer.id),
    category: offer.goal,
    provider: { "@type": "BankOrCreditUnion", name: offer.bank, address: { "@type": "PostalAddress", addressCountry: offer.country } },
    areaServed: { "@type": "Country", name: offer.country },
    offers: {
      "@type": "Offer",
      description: `${offer.reward.description}${offer.commitment_months ? ` Commitment: ${offer.commitment_months} months.` : ""}`,
      url: offer.source_url,
      priceCurrency: "EUR",
      ...(offer.valid_until ? { validThrough: offer.valid_until } : {}),
      eligibleRegion: { "@type": "Country", name: offer.country },
    },
    feesAndCommissionsSpecification: feesText(offer),
    dateModified: offer.verified_on,
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "BankJar estimated first-year net value (default profile)",
        value: score.net_value_eur,
        unitText: "EUR",
      },
    ],
  };
  if (offer.rate_tae !== null) data.annualPercentageRate = offer.rate_tae;
  return data;
}

/** Escape what could end the script tag early. JSON.stringify leaves "<" alone. */
export function serializeJsonLd(data: JsonLdObject): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function JsonLd({ data }: { data: JsonLdObject }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
