/**
 * Rule-based intent parser. English, Spanish and Russian.
 *
 * It turns a free-text question into a goal plus the profile fields it can
 * find (income, balance, longest commitment, residency, cash preference,
 * banks the person already uses). No AI, no network. The optional AI step in
 * src/server/ai.ts fills the same `Intent` type.
 *
 * How the goal is chosen: each goal has strong keywords and weak keywords.
 * A goal scores 10 for a strong hit and 1 for a weak hit. The top score wins.
 * On a tie the goal order is welcome, salary, deposit, savings, account.
 * "Without payroll", "no fixed salary", "I don't get a salary", "sin nomina"
 * and "bez zarplaty" are removed before salary words are looked for; they
 * count as a strong welcome hit only when no other goal word is present.
 *
 * Confidence is 0 with no goal. With a goal it starts at 0.7 (strong hit) or
 * 0.4 (weak hit only), loses 0.2 when another goal is just as strong, and gains
 * 0.1 for every profile field found, up to 0.3.
 */

import type { Goal } from "./schema";
import type { ProfileInput } from "./profile";

export interface Intent {
  goal: Goal | null;
  profile: Partial<ProfileInput>;
  /** 0..1. */
  confidence: number;
  /** What was recognised, as "key:value" strings. */
  matched: string[];
}

const B0 = "(?<![\\p{L}\\d])"; // not preceded by a letter or digit
const B1 = "(?![\\p{L}\\d])"; // not followed by a letter or digit

function re(source: string, flags = "iu"): RegExp {
  return new RegExp(source, flags);
}

/** Lower-case, drop Spanish accents, fold the Russian yo. Keeps Cyrillic y-breve intact. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[áàä]/g, "a")
    .replace(/[éè]/g, "e")
    .replace(/[íì]/g, "i")
    .replace(/[óòö]/g, "o")
    .replace(/[úùü]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/ё/g, "е");
}

// --- Goals ---------------------------------------------------------------

const GOAL_PRIORITY: Goal[] = ["welcome", "salary", "deposit", "savings", "account"];

const STRONG: Record<Goal, RegExp[]> = {
  salary: [
    re(`${B0}(salary|salaries|payroll|paycheck|paychecks|wages?|sueldo)${B1}`),
    re(`${B0}(nomina|domicili)`),
    re("зарплат|жалованье"),
    re(`${B0}direct deposit of (my )?(salary|pay)`),
  ],
  savings: [
    re(`${B0}(savings?|high[\\s-]?yield|interest[\\s-]?bearing)${B1}`),
    re(`${B0}(ahorr|remunerad)`),
    re("сбереж|накопит|накопл"),
    re(`${B0}(emergency|rainy[\\s-]?day)\\s+(fund|savings|cushion)|${B0}(fondo\\s+de\\s+emergencia|colchon)${B1}`),
    re("подушк\\p{L}*\\s+безопасност"),
  ],
  deposit: [
    re(`${B0}(term|time|fixed[\\s-]?term)\\s+deposits?${B1}`),
    re(`${B0}(?<!direct\\s)deposits?${B1}`),
    re(`${B0}(deposito|imposicion|plazo)`),
    re("депозит|вклад|плазо"),
  ],
  account: [
    re(`${B0}free\\s+(?:[\\p{L}]+\\s+){0,2}(account|bank)`),
    re(`${B0}(everyday|current|checking)\\s+account`),
    re(`${B0}(no[\\s-]?fees?|fee[\\s-]?free|zero[\\s-]?fees?|without\\s+fees)${B1}`),
    re(`${B0}(sin\\s+comision|cuenta\\s+(corriente|gratis|gratuita|sin))`),
    re("бесплатн\\p{L}*\\s+(?:\\p{L}+\\s+)?(?:счет|счёт|карт)|без\\s+комисси|текущ\\p{L}*\\s+сч"),
  ],
  welcome: [
    re(`${B0}(welcome|signup|sign[\\s-]?up\\s+bonus)`),
    re(`${B0}new\\s+customers?\\s+(bonus|offer|reward)`),
    re(`${B0}(bienvenida|bono\\s+de\\s+alta)`),
    re("приветствен|бонус\\p{L}*\\s+за\\s+открытие"),
  ],
};

const WEAK: Record<Goal, RegExp[]> = {
  salary: [],
  savings: [],
  deposit: [],
  account: [re(`${B0}(accounts?|cuentas?|bank\\s+account)${B1}`), re("сч[её]т")],
  welcome: [re(`${B0}(bonus|bono)${B1}`), re("бонус")],
};

/**
 * "No payroll", "no fixed salary", "I don't get a salary", "sin nomina fija", "без зарплаты",
 * "не получаю зарплату": the person does not move a salary.
 */
const SALARY_QUALIFIER =
  "a|an|the|my|mi|any|una?|fixed|regular|steady|stable|monthly|official|fija|fijo|estable|mensual|постоянн\\p{L}*|официальн\\p{L}*|стабильн\\p{L}*|белой";
const NO_SALARY = re(
  `${B0}(?:without|with\\s+no|no|sin|без|нет|(?:don['’]?t|do\\s+not|never)\\s+(?:have|get|receive|earn)|not\\s+on|no\\s+(?:tengo|cobro|recibo)|не\\s+получаю)\\s+(?:(?:${SALARY_QUALIFIER})\\s+){0,2}(payroll|salary|nomina|domiciliacion|direct\\s+deposit|зарплат\\p{L}*)`,
  "giu",
);

// --- Profile fields ----------------------------------------------------------

const NO_COMMITMENT = re(
  `${B0}(no|without|zero)\\s+(any\\s+)?(commitment|lock[\\s-]?in|minimum\\s+stay)|sin\\s+(permanencia|compromiso)|без\\s+(обязательств|привязк)`,
);

const NON_RESIDENT = re(`${B0}(non[\\s-]*resident|no[\\s-]*residente|not\\s+(?:a\\s+)?resident|sin\\s+residencia)|нерезидент|не\\s+резидент`);
const RESIDENT = re(`${B0}resident(e)?${B1}|резидент`);
const NIE_TIE_STRICT = /(?<![A-Za-z])(NIE|TIE)(?![A-Za-z])/;
const NIE_TIE_LOOSE = re(`${B0}(with|have|has|got|con|tengo)\\s+(a\\s+|un\\s+|mi\\s+)?(nie|tie)${B1}`);

const PREFER_CASH = re(
  `${B0}(cash[\\s-]*only|only\\s+cash|no\\s+gifts?|en\\s+efectivo|solo\\s+efectivo|sin\\s+regalos)|только\\s+деньги|без\\s+подарк|наличн|деньгами`,
);

const NET = re(`${B0}(net|neto|neta)${B1}|нетто|на\\s+руки`);

const KNOWN_BANKS: Array<[slug: string, pattern: string]> = [
  ["bbva", "bbva"],
  ["santander", "santander"],
  ["caixabank", "caixa\\s?bank|caixa"],
  ["sabadell", "sabadell"],
  ["ing", "ing"],
  ["openbank", "open\\s?bank"],
  ["bankinter", "bankinter"],
  ["unicaja", "unicaja"],
  ["abanca", "abanca"],
  ["kutxabank", "kutxa\\s?bank"],
  ["ibercaja", "ibercaja"],
  ["evo", "evo"],
  ["revolut", "revolut"],
  ["n26", "n26"],
  ["wise", "wise"],
  ["cajamar", "cajamar"],
  ["myinvestor", "my\\s?investor"],
  ["imagin", "imagin"],
];
const CUSTOMER_CUE = re(
  `${B0}(customer|client|cliente|already|ya|existing|my\\s+bank|mi\\s+banco|account\\s+(?:at|with)|cuenta\\s+(?:en|con)|tengo)${B1}|клиент|уже|мой\\s+банк`,
);

/** A negation right before the customer cue: "not a customer of", "no soy cliente de", "я не клиент". */
const NEGATED_CUE = re(
  `(?:${B0}(?:not|never|no\\s+soy|no\\s+tengo|no\\s+estoy|nunca|не|нет)${B1}|n't)\\s+(?:[\\p{L}']+\\s+){0,4}$`,
);

// --- Amounts -------------------------------------------------------------

const AMOUNT = new RegExp(
  `(?<![\\p{L}\\d.,])(€\\s?)?(\\d{1,3}(?:[.,\\s]\\d{3})+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?)\\s?(k|к|тыс\\.?|thousand)?${B1}\\s?(€|eur${B1}|euros?${B1}|евро)?`,
  "giu",
);
const INCOME_WORDS = re(
  `${B0}(salary|salaries|payroll|paycheck|wages?|income|earn(?:s|ing)?(?!\\s+(?:some\\s+)?(?:interest|something|anything|returns?|a\\s+return|more))|make|nomina|sueldo|ingresos?|gano|cobro|cobrar|net|neto|neta)${B1}|зарплат\\p{L}*|доход\\p{L}*|получаю|зарабатываю|нетто|на\\s+руки`,
  "giu",
);
const BALANCE_WORDS = re(
  `${B0}(savings?|balance|deposit|deposito|saldo|park|put|save|have|hay|tengo|fund|fondo|cushion|colchon|ahorr\\p{L}*|invest\\p{L}*)${B1}|подушк\\p{L}*|накоплен\\p{L}*|вклад\\p{L}*|депозит\\p{L}*|сбереж\\p{L}*|размест\\p{L}*|положить|на\\s+счету`,
  "giu",
);
const ANNUAL_AFTER = re(
  `^\\s*(?:per\\s+year|a\\s+year|/\\s?(?:yr|year)|annual\\p{L}*|yearly|per\\s+annum|al\\s+ano|anual\\p{L}*|por\\s+ano|в\\s+год|/год)`,
);
const ANNUAL_BEFORE = re(`(annual|yearly|anual|годов\\p{L}*)\\s+(salary|income|nomina|sueldo|зарплат\\p{L}*)?\\s*(of|de|is|:)?\\s*$`);
const FEE_AFTER = re(`^\\s*(fees?|commissions?|comision|comisiones|комисси)`);
const DURATION_AFTER = re(`^\\s*[-\\s]?(months?|meses|mes${B1}|месяц|мес${B1}|years?|anos?|лет|год)`);

function parseNumber(raw: string): number {
  const s = raw.replace(/\s/g, "");
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = Math.max(lastDot, lastComma);
    return Number(`${s.slice(0, dec).replace(/[.,]/g, "")}.${s.slice(dec + 1)}`);
  }
  const sep = lastDot >= 0 ? "." : lastComma >= 0 ? "," : null;
  if (sep === null) return Number(s);
  const parts = s.split(sep);
  if (parts.length > 2) return Number(parts.join(""));
  const [a = "", b = ""] = parts;
  if (b.length === 3 && a !== "0") return Number(a + b);
  return Number(`${a}.${b}`);
}

/** Distance in characters from an amount to the nearest word of a class, or Infinity. */
function nearest(words: RegExp, text: string, start: number, end: number): number {
  const before = text.slice(Math.max(0, start - 35), start);
  const after = text.slice(end, end + 25);
  let best = Number.POSITIVE_INFINITY;
  for (const m of before.matchAll(words)) best = Math.min(best, before.length - (m.index + m[0].length));
  for (const m of after.matchAll(words)) best = Math.min(best, m.index);
  return best;
}

interface Amounts {
  income?: number;
  balance?: number;
}

function findAmounts(text: string, goal: Goal | null): Amounts {
  const out: Amounts = {};
  for (const m of text.matchAll(AMOUNT)) {
    const [whole, euroBefore, num, suffix, euroAfter] = m;
    if (num === undefined) continue;
    const start = m.index;
    const end = start + whole.length;
    const rest = text.slice(end);
    if (/^\s*(%|percent|por\s+ciento|процент)/i.test(rest)) continue;

    const hasCurrency = Boolean(euroBefore || euroAfter);
    let value = parseNumber(num);
    if (suffix) value *= 1000;
    if (!Number.isFinite(value) || value < 0) continue;
    // A stated 0 is kept, but "0€ fees" is a price, not a balance.
    if (value === 0 && FEE_AFTER.test(rest)) continue;

    if (!hasCurrency && !suffix) {
      // A bare number counts only next to a money word, and never as a duration or a year.
      if (value < 100 || DURATION_AFTER.test(rest)) continue;
      if (value >= 1900 && value <= 2100 && nearest(INCOME_WORDS, text, start, end) === Infinity) continue;
    }

    const incomeDist = nearest(INCOME_WORDS, text, start, end);
    const balanceDist = nearest(BALANCE_WORDS, text, start, end);
    let kind: "income" | "balance" | null = null;
    if (incomeDist < balanceDist) kind = "income";
    else if (balanceDist < incomeDist) kind = "balance";
    else if (goal === "salary") kind = "income";
    else if (goal === "savings" || goal === "deposit") kind = "balance";
    if (kind === null) continue;
    if (value === 0 && incomeDist === Infinity && balanceDist === Infinity) continue;
    if (!hasCurrency && !suffix && incomeDist === Infinity && balanceDist === Infinity) continue;

    if (kind === "income") {
      const before = text.slice(Math.max(0, start - 25), start);
      if (ANNUAL_AFTER.test(rest) || ANNUAL_BEFORE.test(before)) value = Math.round(value / 12);
      out.income ??= value;
    } else {
      out.balance ??= value;
    }
  }
  return out;
}

// --- Durations -------------------------------------------------------------

/** Words that tie a duration to the commitment the person accepts. */
const COMMITMENT_WORD = re(`${B0}(commitment|lock[\\s-]?in|minimum\\s+stay|permanencia|compromiso)|обязательств`);
/** A limit phrase directly before the duration: "up to 12 months". */
const LIMIT_BEFORE = re(`(?:${B0}(?:at\\s+most|up\\s+to|max(?:imum)?|hasta|maximo|como\\s+maximo)|не\\s+более|${B0}до)\\s*$`);
/** Residence and age durations: "resident for 2 years", "I am 30 years old". */
const RESIDENCE_BEFORE = re(
  `(resident\\p{L}*|residenc\\p{L}*|residen\\p{L}*|living|lived|live|resido|vivo|llevo|aged?|edad|since|desde|живу|проживаю|резидент\\p{L}*|мне)\\W+(?:\\p{L}+\\W+){0,3}$`,
);
const AGE_AFTER = re(`^\\W*(old|of\\s+age|de\\s+edad|в\\s+(?:испании|стране))`);

function findDurationMonths(text: string, goal: Goal | null): number | undefined {
  const hits: Array<{ index: number; end: number; months: number }> = [];
  const add = (regex: RegExp, toMonths: (m: RegExpMatchArray) => number) => {
    for (const m of text.matchAll(regex)) hits.push({ index: m.index, end: m.index + m[0].length, months: toMonths(m) });
  };
  add(re(`(\\d{1,3})[\\s-]*(?:months?|meses|mes${B1}|месяц\\p{L}*|мес${B1})`, "giu"), (m) => Number(m[1]));
  add(re(`(\\d{1,2})[\\s-]*(?:years?|yrs?|anos?|лет|года?|год)${B1}`, "giu"), (m) => Number(m[1]) * 12);
  add(re(`${B0}(?:for\\s+(?:a|one|1)|one|un|por\\s+un|на(?:\\s+один|\\s+1)?)[\\s-]*(?:year|ano|год)${B1}`, "giu"), () => 12);
  add(re(`${B0}(?:for\\s+(?:a|one|1)|one|un|por\\s+un|на(?:\\s+один|\\s+1)?)[\\s-]*(?:month|mes|месяц)${B1}`, "giu"), () => 1);
  hits.sort((a, b) => a.index - b.index);
  const first = hits.find((h) => {
    if (h.months <= 0 || h.months > 120) return false;
    const before = text.slice(Math.max(0, h.index - 40), h.index);
    const after = text.slice(h.end, h.end + 30);
    if (RESIDENCE_BEFORE.test(before) || AGE_AFTER.test(after)) return false;
    if (COMMITMENT_WORD.test(before.slice(-30)) || COMMITMENT_WORD.test(after) || LIMIT_BEFORE.test(before)) return true;
    // The product term: "12-month deposit" is the deposit term.
    return goal === "deposit";
  });
  return first?.months;
}

// --- Main ------------------------------------------------------------------

export function parseIntent(input: string): Intent {
  const original = input;
  let text = normalize(input);
  const matched: string[] = [];
  const profile: Partial<ProfileInput> = {};

  // Goal.
  let noSalary = false;
  text = text.replace(NO_SALARY, () => {
    noSalary = true;
    return " ";
  });
  const strong = new Map<Goal, boolean>();
  const weak = new Map<Goal, boolean>();
  for (const goal of GOAL_PRIORITY) {
    strong.set(goal, STRONG[goal].some((r) => r.test(text)));
    weak.set(goal, WEAK[goal].some((r) => r.test(text)));
  }
  // "Without payroll" means welcome only when no other goal word is present.
  if (noSalary && GOAL_PRIORITY.every((g) => g === "welcome" || (!strong.get(g) && !weak.get(g)))) {
    strong.set("welcome", true);
  }
  const score = (g: Goal) => (strong.get(g) ? 10 : 0) + (weak.get(g) ? 1 : 0);
  let goal: Goal | null = null;
  let top = 0;
  for (const g of GOAL_PRIORITY) {
    if (score(g) > top) {
      top = score(g);
      goal = g;
    }
  }
  const rivals = GOAL_PRIORITY.filter((g) => g !== goal && strong.get(g) && score(g) >= top).length;
  if (goal) matched.push(`goal:${goal}`);
  if (noSalary) matched.push("no_salary");
  if (goal) profile.goal = goal;

  // Amounts.
  const amounts = findAmounts(text, goal);
  if (amounts.income !== undefined) {
    profile.monthly_income_eur = amounts.income;
    matched.push(`monthly_income_eur:${amounts.income}`);
  }
  if (amounts.balance !== undefined) {
    profile.balance_eur = amounts.balance;
    matched.push(`balance_eur:${amounts.balance}`);
  }
  if (NET.test(text)) matched.push("net");

  // Commitment.
  if (NO_COMMITMENT.test(text)) {
    profile.max_commitment_months = 0;
    matched.push("max_commitment_months:0");
  } else {
    const months = findDurationMonths(text, goal);
    if (months !== undefined) {
      profile.max_commitment_months = months;
      matched.push(`max_commitment_months:${months}`);
    }
  }

  // Residency.
  if (NON_RESIDENT.test(text)) {
    profile.residency = "non_resident";
  } else if (NIE_TIE_STRICT.test(original) || NIE_TIE_LOOSE.test(text)) {
    profile.residency = "nie_tie";
  } else if (RESIDENT.test(text)) {
    profile.residency = "resident";
  }
  if (profile.residency) matched.push(`residency:${profile.residency}`);

  // Cash only.
  if (PREFER_CASH.test(text)) {
    profile.prefer = "cash";
    matched.push("prefer:cash");
  }

  // Banks the person already uses.
  const existing: string[] = [];
  for (const [slug, pattern] of KNOWN_BANKS) {
    const bank = re(`${B0}(${pattern})${B1}`, "giu");
    for (const m of text.matchAll(bank)) {
      const before = text.slice(Math.max(0, m.index - 40), m.index);
      if (CUSTOMER_CUE.test(before) && !NEGATED_CUE.test(before) && !existing.includes(slug)) existing.push(slug);
    }
  }
  if (existing.length > 0) {
    profile.existing_customer_of = existing;
    matched.push(...existing.map((s) => `existing_customer_of:${s}`));
  }

  // Confidence.
  let confidence = 0;
  if (goal) {
    confidence = top >= 10 ? 0.7 : 0.4;
    if (rivals > 0) confidence -= 0.2;
    const extras = Object.keys(profile).filter((k) => k !== "goal").length;
    confidence += Math.min(extras, 3) * 0.1;
  }
  confidence = Math.max(0, Math.min(1, Math.round(confidence * 100) / 100));

  return { goal, profile, confidence, matched };
}
