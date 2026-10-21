import { z } from "zod";
import { GoalSchema } from "./schema";

/**
 * What we know about the person asking. Every field is optional on input;
 * `makeProfile` fills the defaults.
 */
export const ProfileSchema = z.object({
  goal: GoalSchema.optional(),
  monthly_income_eur: z.number().finite().nonnegative().optional(),
  /** Money the person would move or park. Drives interest on rate offers. */
  balance_eur: z.number().finite().nonnegative().default(10000),
  /** Longest commitment accepted. 0 means no commitment at all. */
  max_commitment_months: z.number().int().nonnegative().optional(),
  residency: z.enum(["resident", "nie_tie", "non_resident", "unknown"]).default("unknown"),
  /** Bank slugs where the person is already a customer. */
  existing_customer_of: z.array(z.string()).default([]),
  /** Share of retail value a gift is worth to the person, 0..1. */
  gift_factor: z.number().min(0).max(1).default(0.8),
  prefer: z.enum(["cash", "any"]).default("any"),
});

export type Profile = z.output<typeof ProfileSchema>;
export type ProfileInput = z.input<typeof ProfileSchema>;

export function makeProfile(input: ProfileInput = {}): Profile {
  return ProfileSchema.parse(input);
}
