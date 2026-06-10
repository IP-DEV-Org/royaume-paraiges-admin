import { z } from "zod";
import { consumptionTypeSchema } from "./quest.schema";

/**
 * Validation des payloads pour la table `establishments` (édition via
 * /content/establishments/[id]) et la table de jonction
 * `establishment_consumption_types`.
 */
export const establishmentSchema = z.object({
  title: z.string().min(1, "Nom requis").max(200),
  short_description: z.string().max(150, "150 caractères maximum").nullable(),
  description: z.string().max(5000).nullable(),
  line_address_1: z.string().max(200).nullable(),
  line_address_2: z.string().max(200).nullable(),
  zipcode: z.string().max(20).nullable(),
  city: z.string().max(120).nullable(),
  country: z.string().max(120).nullable(),
  // Le form envoie la partie date (YYYY-MM-DD) ; un ISO complet reste accepté.
  anniversary: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}/, "Format de date attendu : AAAA-MM-JJ")
    .nullable(),
  featured_image: z.string().max(500).nullable(),
  logo: z.string().max(500).nullable(),
});

export const establishmentUpdateSchema = establishmentSchema.partial();

export const establishmentConsumptionTypesSchema = z.array(
  z.object({
    consumption_type: consumptionTypeSchema,
    is_active: z.boolean(),
  })
);

export type EstablishmentInput = z.infer<typeof establishmentSchema>;
export type EstablishmentUpdateInput = z.infer<
  typeof establishmentUpdateSchema
>;
