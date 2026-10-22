import { z } from "zod";
import { isoDate, kebab } from "./schema";

/**
 * The shape of one bank-app file: data/apps/<country>/<bank_slug>.yaml.
 * Store numbers (rating, rating count, last update, languages) are written by
 * scripts/fetch-apps.ts from the App Store lookup API and Google Play's page;
 * features are written by hand, each with the URL that shows it.
 */

export const APP_FEATURES = ["bizum", "apple_pay", "google_pay"] as const;
export type AppFeature = (typeof APP_FEATURES)[number];

const rating = z.number().finite().min(0).max(5);

const StoreFields = {
  url: z.url(),
  /** Average stars, 0..5. Null when the store shows no rating yet. */
  rating: rating.nullable(),
  ratings_count: z.number().int().nonnegative(),
  /** Date of the latest release in the store. */
  updated_on: isoDate.nullable(),
};

export const IosSchema = z.object({
  app_id: z.number().int().positive(),
  ...StoreFields,
  /** ISO 639-1 codes, upper case, as the App Store lists them. */
  languages: z.array(z.string().regex(/^[A-Z]{2}$/)),
});

export const AndroidSchema = z.object({
  package: z.string().regex(/^[A-Za-z][\w]*(\.[A-Za-z_][\w]*)+$/, "must be a Java package name, e.g. com.bank.app"),
  ...StoreFields,
});

export const FeatureSchema = z
  .object({
    value: z.boolean().nullable(),
    source_url: z.url().nullable(),
  })
  .refine((f) => f.value === null || f.source_url !== null, "a known value needs a source_url");

export const AppSchema = z
  .object({
    id: kebab,
    bank: z.string().min(1),
    /** Same slug as the bank's offers, so the two can link. */
    bank_slug: kebab,
    country: z.string().regex(/^[A-Z]{2}$/, "must be an ISO 3166-1 alpha-2 code, upper case"),
    app_name: z.string().min(1),
    ios: IosSchema.nullable(),
    android: AndroidSchema.nullable(),
    features: z.object({
      bizum: FeatureSchema,
      apple_pay: FeatureSchema,
      google_pay: FeatureSchema,
    }),
    /** The day the store numbers were fetched. */
    verified_on: isoDate,
    notes: z.string().nullable(),
  })
  .refine((a) => a.ios !== null || a.android !== null, "an app needs at least one store: ios or android");

export type BankApp = z.infer<typeof AppSchema>;
