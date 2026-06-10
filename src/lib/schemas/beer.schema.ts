import { z } from "zod";

/**
 * Validation des payloads pour la table `beers` (édition via
 * /content/beers/[id]). Les bornes IBU/ABV reflètent les limites déjà
 * appliquées par le formulaire (attributs min/max des inputs).
 */
export const beerSchema = z.object({
  title: z.string().min(1, "Nom requis").max(200),
  description: z.string().max(5000).nullable(),
  ibu: z
    .number()
    .int("L'IBU doit être un entier")
    .min(0, "L'IBU doit être entre 0 et 120")
    .max(120, "L'IBU doit être entre 0 et 120")
    .nullable(),
  abv: z
    .number()
    .min(0, "L'ABV doit être entre 0 et 20")
    .max(20, "L'ABV doit être entre 0 et 20")
    .nullable(),
  brewery_id: z.number().int().positive().nullable(),
  featured_image: z.string().max(500).nullable(),
});

export const beerUpdateSchema = beerSchema.partial();

export type BeerInput = z.infer<typeof beerSchema>;
export type BeerUpdateInput = z.infer<typeof beerUpdateSchema>;
