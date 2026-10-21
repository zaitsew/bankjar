import { z } from "zod";

/**
 * The shape of one offer file: data/offers/<country>/<id>.yaml.
 * Every number the site shows comes from one of these files.
 */

export const GOALS = ["salary", "savings", "account", "deposit", "welcome"] as const;
export const GoalSchema = z.enum(GOALS);
export type Goal = z.infer<typeof GoalSchema>;

export const REWARD_TYPES = ["cash", "gift", "rate", "fee_waiver", "none"] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO date, YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "is not a real calendar date");

const kebab = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be kebab-case: lowercase letters, digits and single dashes");

const money = z.number().finite().nonnegative();
const nullableMoney = money.nullable();

export const RewardSchema = z.object({
  type: z.enum(REWARD_TYPES),
  value_eur: nullableMoney,
  description: z.string().min(1),
  paid_when: z.string().nullable(),
});

export const RequirementsSchema = z.object({
  min_monthly_income_eur: nullableMoney,
  new_customer_only: z.boolean().nullable(),
  other: z.array(z.string()),
});

export const FeesSchema = z.object({
  monthly_eur: nullableMoney,
  notes: z.string().nullable(),
});

export const EligibilitySchema = z.object({
  residents_only: z.boolean().nullable(),
  nie_tie_ok: z.boolean().nullable(),
  non_residents: z.boolean().nullable(),
  notes: z.string().nullable(),
});

export const OfferSchema = z.object({
  id: kebab,
  bank: z.string().min(1),
  bank_slug: kebab,
  country: z.string().regex(/^[A-Z]{2}$/, "must be an ISO 3166-1 alpha-2 code, upper case"),
  goal: GoalSchema,
  product_name: z.string().min(1),
  headline: z.string().min(1),
  reward: RewardSchema,
  /** Percent, e.g. 2.5 means 2.5% TAE. */
  rate_tae: z.number().finite().nonnegative().nullable(),
  promo_months: z.number().int().positive().nullable(),
  balance_cap_eur: nullableMoney,
  /** 0 means no commitment. */
  commitment_months: z.number().int().nonnegative().nullable(),
  requirements: RequirementsSchema,
  fees: FeesSchema,
  penalty: z.string().nullable(),
  eligibility: EligibilitySchema,
  valid_until: isoDate.nullable(),
  source_url: z.url(),
  confirmed_by: z.enum(["bank", "aggregator"]),
  verified_on: isoDate,
  notes: z.string().nullable(),
  paid_placement: z.boolean().default(false),
});

export type Offer = z.infer<typeof OfferSchema>;
export type RewardType = Offer["reward"]["type"];
