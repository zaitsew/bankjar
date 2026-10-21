import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { makeProfile } from "../src/core/profile";
import { scoreOffer } from "../src/core/score";
import { JsonLd, offerJsonLd, serializeJsonLd } from "../src/server/jsonld";
import { fixture, makeOffer, TODAY } from "./helpers/offers";
import { SITE, useFixtureEnv } from "./helpers/api";

beforeAll(useFixtureEnv);

function ld(id: string) {
  const o = fixture(id);
  return { o, data: offerJsonLd(o, scoreOffer(o, makeProfile({ goal: o.goal }), TODAY)) as any };
}

describe("offerJsonLd", () => {
  it("describes a rate offer as a DepositAccount with APR, provider, offer and dates", () => {
    const { o, data } = ld("testbank-saver");
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("DepositAccount");
    expect(data.name).toBe(o.product_name);
    expect(data.url).toBe(`${SITE}/offer/${o.id}`);
    expect(data.provider).toMatchObject({ "@type": "BankOrCreditUnion", name: "Testbank" });
    expect(data.annualPercentageRate).toBe(3);
    expect(data.offers).toMatchObject({ "@type": "Offer", url: o.source_url });
    expect(data.dateModified).toBe(o.verified_on);
    expect(data.feesAndCommissionsSpecification).toContain("No monthly fee");
  });

  it("uses BankAccount for salary and account goals, and leaves out APR without a rate", () => {
    const { data } = ld("testbank-payroll-cash");
    expect(data["@type"]).toBe("BankAccount");
    expect("annualPercentageRate" in data).toBe(false);
  });

  it("sets validThrough only when the offer expires", () => {
    const open = makeOffer({ valid_until: null });
    const dated = makeOffer({ valid_until: "2026-12-31" });
    const s = scoreOffer(open, makeProfile({ goal: open.goal }), TODAY);
    expect((offerJsonLd(open, s) as any).offers.validThrough).toBeUndefined();
    expect((offerJsonLd(dated, s) as any).offers.validThrough).toBe("2026-12-31");
  });

  it("falls back to FinancialProduct for welcome offers", () => {
    const o = makeOffer({ goal: "welcome" });
    const s = scoreOffer(o, makeProfile({ goal: "welcome" }), TODAY);
    expect((offerJsonLd(o, s) as any)["@type"]).toBe("FinancialProduct");
  });
});

describe("<JsonLd>", () => {
  it("renders a ld+json script that survives a closing script tag in the data", () => {
    const html = renderToStaticMarkup(createElement(JsonLd, { data: { "@type": "Thing", name: "</script><b>x" } }));
    expect(html.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    const inner = html.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
    expect(JSON.parse(inner).name).toBe("</script><b>x");
    expect(serializeJsonLd({ a: "<" })).toBe('{"a":"\\u003c"}');
  });
});
