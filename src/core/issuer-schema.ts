import { z } from "zod";
import { isoDate, kebab } from "./schema";

/**
 * One issuer file: data/issuers/<country>/<bank_slug>.yaml.
 * It records which deposit-guarantee scheme covers deposits at the licensed bank
 * behind an offer. It is read-only context: it never enters the score or the order.
 */

export const IssuerSchema = z.object({
  bank_slug: kebab,
  /** The licensed credit institution that holds the deposit, exactly as the source names it. */
  legal_entity: z.string().min(1),
  /** ISO 3166-1 alpha-2 code of the country that licensed the institution. */
  country_of_licence: z.string().regex(/^[A-Z]{2}$/, "must be an ISO 3166-1 alpha-2 code, upper case"),
  /** Null when the source does not name the scheme; say why in notes. Never guessed. */
  scheme_name: z.string().min(1).nullable(),
  scheme_country: z.string().regex(/^[A-Z]{2}$/, "must be an ISO 3166-1 alpha-2 code, upper case").nullable(),
  cover_eur: z.number().finite().positive(),
  cover_basis: z.string().min(1),
  /** Other trade names that share this licence, hence one cap. */
  brand_aliases: z.array(z.string().min(1)),
  source_url: z.url(),
  verified_on: isoDate,
  notes: z.string().nullable(),
});

export type Issuer = z.infer<typeof IssuerSchema>;

/** The read-only facts an offer row carries about who guarantees its deposits. */
export interface IssuerGuarantee {
  legal_entity: string;
  country_of_licence: string;
  scheme_name: string | null;
  scheme_country: string | null;
  cover_eur: number;
  cover_basis: string;
  brand_aliases: string[];
  /** Other banks in this dataset deposited at the same licence: one cap covers all of them. */
  shared_cap_with: { bank_slug: string; bank: string }[];
  source_url: string;
  verified_on: string;
  notes: string | null;
}
