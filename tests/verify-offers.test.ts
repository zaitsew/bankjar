import { describe, expect, it } from "vitest";
import {
  blockedVerdict,
  buildReport,
  checkText,
  checkableNumbers,
  findEuroAmounts,
  findMonths,
  findPercentages,
  htmlToText,
  parseNumberToken,
  renderMarkdown,
  type OfferReport,
} from "../src/core/verify-offers";
import { makeOffer } from "./helpers/offers";

const PAD = " Lorem ipsum dolor sit amet, consectetur adipiscing elit.".repeat(12);
const page = (s: string) => `${s}${PAD}`;

describe("parseNumberToken", () => {
  it.each([
    ["1.200", 1200],
    ["1,200", 1200],
    ["1200", 1200],
    ["1 200", 1200],
    ["1.200,50", 1200.5],
    ["1,200.50", 1200.5],
    ["2,5", 2.5],
    ["2.5", 2.5],
    ["0,500", 0.5],
    ["1.200.000", 1200000],
  ])("reads %s as %s", (token, n) => {
    expect(parseNumberToken(token)).toBe(n);
  });
  it.each(["", "abc", "1.", "12.34.5"])("rejects %j", (t) => {
    expect(parseNumberToken(t)).toBeNull();
  });
});

describe("finders", () => {
  it("treats Spanish and English euro formats as the same amount", () => {
    for (const s of ["1.200 €", "1,200 EUR", "€1200", "EUR 1.200", "1200 euros", "1.200€"]) {
      expect(findEuroAmounts(s)).toContain(1200);
    }
  });
  it("ignores bare numbers with no currency", () => {
    expect(findEuroAmounts("Call 1200 now, code 500")).toEqual([]);
  });
  it("treats 2,5 % and 2.5% as the same rate", () => {
    expect(findPercentages("TAE del 2,5 %")).toContain(2.5);
    expect(findPercentages("up to 2.5% APY")).toContain(2.5);
    expect(findPercentages("2,50 %")).toContain(2.5);
  });
  it("reads months and years", () => {
    expect(findMonths("permanencia de 24 meses")).toContain(24);
    expect(findMonths("a 12-month stay")).toContain(12);
    expect(findMonths("durante 2 años")).toContain(24);
    expect(findMonths("1 year")).toContain(12);
  });
});

describe("htmlToText", () => {
  it("drops scripts, styles and tags and decodes entities", () => {
    const html = `<html><head><title>t</title><style>.a{}</style></head><body><script>var x = "999 €";</script><p>Gana&nbsp;500&nbsp;&euro; &amp; m&#225;s</p></body></html>`;
    const text = htmlToText(html);
    expect(text).toBe("Gana 500 € & más");
    expect(findEuroAmounts(text)).toEqual([500]);
  });
});

describe("checkableNumbers", () => {
  it("skips null and zero", () => {
    const o = makeOffer({
      reward: { value_eur: 0 },
      rate_tae: null,
      commitment_months: 0,
      requirements: { min_monthly_income_eur: null },
      fees: { monthly_eur: 0 },
    });
    expect(checkableNumbers(o)).toEqual([]);
  });
});

describe("checkText statuses", () => {
  const offer = makeOffer({
    reward: { value_eur: 1200 },
    rate_tae: 2.5,
    commitment_months: 24,
    requirements: { min_monthly_income_eur: 800 },
    fees: { monthly_eur: 0 },
  });

  it("ok: every checkable number is found", () => {
    const v = checkText(offer, page("Gana 1.200 € con TAE 2,5 %, permanencia 24 meses, nómina desde 800 euros."));
    expect(v.status).toBe("ok");
    expect(v.missing).toEqual([]);
    expect(v.checked).toHaveLength(4);
  });

  it("mismatch: lists which numbers were not found", () => {
    const v = checkText(offer, page("Gana 600 € con TAE 2,5 %, permanencia 24 meses, nómina desde 800 euros."));
    expect(v.status).toBe("mismatch");
    expect(v.missing).toEqual(["reward.value_eur"]);
  });

  it("unverifiable: the page loaded and nothing is checkable", () => {
    const empty = makeOffer({
      reward: { value_eur: null },
      rate_tae: null,
      commitment_months: null,
      requirements: { min_monthly_income_eur: null },
      fees: { monthly_eur: null },
    });
    const v = checkText(empty, page("Una página normal."));
    expect(v.status).toBe("unverifiable");
  });

  it("blocked: text too short", () => {
    const v = checkText(offer, "Gana 1.200 € con TAE 2,5 %, 24 meses, 800 euros.");
    expect(v.status).toBe("blocked");
  });

  it("blocked: a bot wall is never ok, even when it repeats the numbers", () => {
    const wall = "Just a moment... " + "Gana 1.200 € con TAE 2,5 %, 24 meses, 800 euros. ".repeat(10);
    expect(wall.length).toBeGreaterThan(400);
    const v = checkText(offer, wall);
    expect(v.status).toBe("blocked");
    expect(v.reason).toMatch(/bot wall/);
  });

  it("blocked: a failed fetch carries no checks", () => {
    const v = blockedVerdict("HTTP 403");
    expect(v).toEqual({ status: "blocked", reason: "HTTP 403", checked: [], missing: [] });
  });
});

describe("false ok guards (review of the first version)", () => {
  const only500 = makeOffer({
    reward: { type: "cash", value_eur: 500, description: "d", paid_when: null },
    rate_tae: null,
    commitment_months: 0,
    requirements: { min_monthly_income_eur: null },
    fees: { monthly_eur: 0, notes: null },
  } as never);

  it("the fixture has exactly one checkable number, so a mismatch below can only come from it", () => {
    expect(checkableNumbers(only500)).toEqual([{ field: "reward.value_eur", expected: 500 }]);
    expect(checkText(only500, htmlToText(`<p>500 €</p><p>${PAD}</p>`)).status).toBe("ok");
  });


  it.each([
    ["hidden attribute", '<div hidden>500 €</div>'],
    ["bare hidden with other attributes", '<div class="x" hidden data-y="1">500 €</div>'],
    ["aria-hidden", '<span aria-hidden="true">500 €</span>'],
    ["display none", '<div style="color:red; display: none">500 €</div>'],
    ["visibility hidden", "<p style='visibility:hidden'>500 €</p>"],
    ["nested elements", "<div hidden><div>x</div><div>500 €</div></div>"],
    ["unquoted style", "<div style=display:none>500 €</div>"],
    ["a quoted > before hidden", '<div title="a > b" hidden>500 €</div>'],
    ["a trailing slash on a non-void element", "<div hidden/>500 €</div>"],
  ])("a number in hidden HTML is not found: %s", (_, hidden) => {
    const text = htmlToText(`<main><p>300 €</p>${hidden}<p>${PAD}</p></main>`);
    expect(text).toContain("300 €");
    expect(text).not.toContain("500");
    expect(checkText(only500, text).status).toBe("mismatch");
  });

  it("keeps visible text around a hidden element, and text after it", () => {
    const text = htmlToText("<p>before</p><div hidden><br>gone</div><p>after</p>");
    expect(text).toBe("before after");
  });

  it("a class or value containing the word hidden hides nothing", () => {
    const text = htmlToText('<div class="hidden sm:block" title="hidden">500 €</div>');
    expect(text).toContain("500 €");
  });

  it("an element that never closes hides the rest of the page", () => {
    expect(htmlToText("<p>before</p><div hidden><p>500 €</p>")).toBe("before");
  });

  it("a long access-denied page is blocked, even with the numbers on it", () => {
    const wall = "Access denied. " + "Gana 500 € con esta cuenta. ".repeat(200);
    expect(wall.length).toBeGreaterThan(2500);
    expect(checkText(only500, wall).status).toBe("blocked");
  });

  it("a captcha at the foot of a long real page does not block it, but one at the top does", () => {
    const body = "Gana 500 € con esta cuenta. ".repeat(200);
    expect(checkText(only500, `${body} Protected by captcha.`).status).toBe("ok");
    expect(checkText(only500, `Solve the captcha to continue. ${body}`).status).toBe("blocked");
  });

  it("a negative figure does not confirm a positive one", () => {
    expect(findPercentages("rentabilidad -2,5 %")).toEqual([]);
    expect(findPercentages("rentabilidad −2,5 %")).toEqual([]);
    expect(findPercentages("TAE 2,5 %")).toEqual([2.5]);
    expect(findEuroAmounts("comisión -500 €")).toEqual([]);
    expect(findPercentages(htmlToText("<span>−</span><span>2,5 %</span>"))).toEqual([]);
    expect(findPercentages("rentabilidad - 2,5 %")).toEqual([]);
  });

  it("a quoted > inside an attribute never leaks the attribute's text", () => {
    expect(htmlToText('<a title="x > 500 €">link</a>')).toBe("link");
  });
});

describe("report", () => {
  const row = (id: string, status: OfferReport["status"]): OfferReport => ({
    id,
    bank: "Testbank",
    source_url: "https://example.com/" + id,
    verified_on: "2026-10-22",
    http_status: status === "blocked" ? 403 : 200,
    text_chars: 1000,
    status,
    reason: status === "blocked" ? "HTTP 403" : null,
    checked: status === "mismatch" ? [{ field: "reward.value_eur", expected: 500, found: false }] : [],
    missing: status === "mismatch" ? ["reward.value_eur"] : [],
  });

  it("counts every status and renders the caveat", () => {
    const r = buildReport([row("a", "ok"), row("b", "mismatch"), row("c", "blocked"), row("d", "blocked")], new Date("2026-11-05T12:00:00Z"));
    expect(r.counts).toEqual({ ok: 1, mismatch: 1, unverifiable: 0, blocked: 2 });
    const md = renderMarkdown(r);
    expect(md).toContain("a person must read the page");
    expect(md).toContain("reward.value_eur=500");
    expect(md).toContain("HTTP 403");
  });
});
