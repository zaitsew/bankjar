import { describe, expect, it } from "vitest";
import { parseIntent } from "../src/core/intent";
import type { Goal } from "../src/core/schema";

type Case = [prompt: string, goal: Goal, profile?: Record<string, unknown>];

const examples: Case[] = [
  // The six example cards from docs/PLAN.md and the owner's own prompt.
  ["Move my salary", "salary"],
  ["Park my savings", "savings"],
  ["Free everyday account", "account"],
  ["Account as a non-resident", "account", { residency: "non_resident" }],
  ["Best 12-month deposit", "deposit", { max_commitment_months: 12 }],
  ["Bonus without payroll", "welcome"],
  ["Find me the best bank offer for transferring my salary", "salary"],
];

const english: Case[] = [
  ["I earn 2,500€ net and want a payroll bonus", "salary", { monthly_income_eur: 2500 }],
  ["Best savings account for €20,000 with no commitment", "savings", { balance_eur: 20000, max_commitment_months: 0 }],
  ["I'm a non-resident, which bank gives a welcome bonus?", "welcome", { residency: "non_resident" }],
  ["cash only, no gifts, move salary 3k", "salary", { monthly_income_eur: 3000, prefer: "cash" }],
  ["I have a NIE and want a free account", "account", { residency: "nie_tie" }],
  ["term deposit of 15.000 euros for 1 year", "deposit", { balance_eur: 15000, max_commitment_months: 12 }],
  ["salary of 2.5k per month, I am a customer of BBVA", "salary", { monthly_income_eur: 2500, existing_customer_of: ["bbva"] }],
  ["savings 2% interest, I have 8000 euros, no lock-in", "savings", { balance_eur: 8000, max_commitment_months: 0 }],
  ["I make 36k a year, which payroll offer is best", "salary", { monthly_income_eur: 3000 }],
];

const spanish: Case[] = [
  ["Quiero domiciliar mi nómina de 2.500 euros", "salary", { monthly_income_eur: 2500 }],
  ["cuenta de ahorro remunerada sin permanencia", "savings", { max_commitment_months: 0 }],
  ["depósito a 12 meses", "deposit", { max_commitment_months: 12 }],
  ["cuenta sin comisiones para no residentes", "account", { residency: "non_resident" }],
  ["bono de bienvenida sin nómina", "welcome"],
  ["Soy residente con TIE, nómina de 1800€ neta", "salary", { monthly_income_eur: 1800, residency: "nie_tie" }],
  ["depósito de 10k a un año", "deposit", { balance_eur: 10000, max_commitment_months: 12 }],
  ["quiero ahorrar, tengo €5,000 y ya soy cliente de Santander", "savings", { balance_eur: 5000, existing_customer_of: ["santander"] }],
];

const russian: Case[] = [
  ["Хочу перевести зарплату 2500 евро", "salary", { monthly_income_eur: 2500 }],
  ["Лучший вклад на 1 год", "deposit", { max_commitment_months: 12 }],
  ["Бесплатный счет для нерезидента", "account", { residency: "non_resident" }],
  ["Накопительный счет без обязательств, 20к евро", "savings", { max_commitment_months: 0, balance_eur: 20000 }],
  ["Бонус без зарплаты", "welcome"],
  ["Только деньги, без подарков, зарплата 3000€", "salary", { prefer: "cash", monthly_income_eur: 3000 }],
  ["депозит на 6 месяцев, 12 000 евро", "deposit", { max_commitment_months: 6, balance_eur: 12000 }],
  ["приветственный бонус банка", "welcome"],
];

describe.each([
  ["examples", examples],
  ["English", english],
  ["Spanish", spanish],
  ["Russian", russian],
])("parseIntent: %s", (_name, cases) => {
  it.each(cases)("%s", (prompt, goal, profile) => {
    const intent = parseIntent(prompt);
    expect(intent.goal).toBe(goal);
    expect(intent.profile.goal).toBe(goal);
    expect(intent.confidence).toBeGreaterThan(0);
    for (const [k, v] of Object.entries(profile ?? {})) {
      expect((intent.profile as Record<string, unknown>)[k]).toEqual(v);
    }
  });
});

describe("parseIntent: details", () => {
  it("returns no goal and zero confidence for unrelated text", () => {
    const i = parseIntent("what is the weather in Valencia");
    expect(i.goal).toBeNull();
    expect(i.confidence).toBe(0);
    expect(i.profile).toEqual({});
  });

  it("returns an empty intent for an empty string", () => {
    expect(parseIntent("")).toEqual({ goal: null, profile: {}, confidence: 0, matched: [] });
  });

  it("is more confident with a strong keyword than with a weak one", () => {
    expect(parseIntent("Move my salary").confidence).toBeGreaterThan(parseIntent("my account").confidence);
  });

  it("is more confident when it finds profile fields", () => {
    expect(parseIntent("Move my salary of 2500 euros").confidence).toBeGreaterThan(parseIntent("Move my salary").confidence);
  });

  it("keeps confidence between 0 and 1", () => {
    const i = parseIntent("salary 3000 euros net, non-resident, cash only, no commitment, 12 months, customer of BBVA");
    expect(i.confidence).toBeLessThanOrEqual(1);
    expect(i.confidence).toBeGreaterThan(0.7);
  });

  it("lists what it matched", () => {
    const i = parseIntent("Best 12-month deposit, I am a non-resident");
    expect(i.matched).toContain("goal:deposit");
    expect(i.matched).toContain("max_commitment_months:12");
    expect(i.matched).toContain("residency:non_resident");
  });

  it.each([
    ["2500€", 2500],
    ["€2,500", 2500],
    ["2.500 euros", 2500],
    ["2k", 2000],
    ["2.5k", 2500],
    ["1 800 EUR", 1800],
    ["3к", 3000],
  ])("reads the amount %s as %d", (amount, expected) => {
    expect(parseIntent(`move my salary, I earn ${amount}`).profile.monthly_income_eur).toBe(expected);
  });

  it("does not read a duration as money", () => {
    const i = parseIntent("best deposit for 24 months");
    expect(i.profile.balance_eur).toBeUndefined();
    expect(i.profile.max_commitment_months).toBe(24);
  });

  it("does not read a rate as money", () => {
    expect(parseIntent("savings account with 3% TAE").profile.balance_eur).toBeUndefined();
  });

  it("tells income from balance by the nearest word", () => {
    const i = parseIntent("I earn 2500 euros and want to park 15000 euros in savings");
    expect(i.profile.monthly_income_eur).toBe(2500);
    expect(i.profile.balance_eur).toBe(15000);
  });

  it.each([
    ["2 years", 24],
    ["1 año", 12],
    ["12 meses", 12],
    ["18 months", 18],
    ["3 года", 36],
  ])("reads the duration %s as %d months", (d, months) => {
    expect(parseIntent(`deposit for ${d}`).profile.max_commitment_months).toBe(months);
  });

  it.each(["no commitment", "sin permanencia", "без обязательств", "without commitment"])(
    "reads %s as zero commitment",
    (phrase) => {
      expect(parseIntent(`savings ${phrase}`).profile.max_commitment_months).toBe(0);
    },
  );

  it("prefers non-resident over resident", () => {
    expect(parseIntent("soy no residente").profile.residency).toBe("non_resident");
    expect(parseIntent("I am a resident of Spain, salary").profile.residency).toBe("resident");
  });

  it("does not treat the word 'tie' in lower case as a TIE card", () => {
    expect(parseIntent("I wear a tie, salary offer").profile.residency).toBeUndefined();
  });

  it("does not mark a bank as existing without a cue", () => {
    expect(parseIntent("welcome bonus at BBVA").profile.existing_customer_of).toBeUndefined();
  });
  describe("review fixes", () => {
    it("keeps a stated zero balance", () => {
      expect(parseIntent("savings balance €0").profile.balance_eur).toBe(0);
      expect(parseIntent("savings account, I have 0 euros").profile.balance_eur).toBe(0);
    });

    it("does not read a zero fee as a balance", () => {
      expect(parseIntent("savings account with 0€ fees").profile.balance_eur).toBeUndefined();
    });

    it("keeps an explicit goal when the person has no payroll", () => {
      expect(parseIntent("savings account without payroll").goal).toBe("savings");
      expect(parseIntent("term deposit sin nómina").goal).toBe("deposit");
      expect(parseIntent("free account without payroll").goal).toBe("account");
      expect(parseIntent("bonus without payroll").goal).toBe("welcome");
    });

    it.each([
      "I am not a customer of BBVA",
      "no soy cliente de BBVA",
      "я не клиент BBVA",
    ])("does not mark a bank as existing after a negation: %s", (prompt) => {
      expect(parseIntent(`best welcome bonus, ${prompt}`).profile.existing_customer_of).toBeUndefined();
    });

    it("still marks a bank when a negation belongs to another phrase", () => {
      expect(parseIntent("savings, no commitment, customer of BBVA").profile.existing_customer_of).toEqual(["bbva"]);
    });

    it("does not read a residence duration as a commitment", () => {
      const i = parseIntent("Resident for 2 years, looking for a 12-month deposit");
      expect(i.profile.max_commitment_months).toBe(12);
      expect(parseIntent("Resident for 2 years, best savings account").profile.max_commitment_months).toBeUndefined();
      expect(parseIntent("llevo 3 años en España, cuenta de ahorro").profile.max_commitment_months).toBeUndefined();
      expect(parseIntent("я резидент 2 года, ищу накопительный счет").profile.max_commitment_months).toBeUndefined();
    });

    it.each([
      ["savings account, lock-in of 6 months", 6],
      ["savings, up to 2 years", 24],
      ["savings, for at most 18 months", 18],
      ["savings, max 1 year", 12],
      ["ahorro con permanencia de 12 meses", 12],
      ["накопительный счет, обязательство 6 месяцев", 6],
    ])("reads a commitment duration: %s", (prompt, months) => {
      expect(parseIntent(prompt).profile.max_commitment_months).toBe(months);
    });
  });
});
