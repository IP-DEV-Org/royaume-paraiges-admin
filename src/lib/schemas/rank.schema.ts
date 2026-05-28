import { z } from "zod";

/**
 * Validation des payloads pour la table `ranks` (groupes de niveaux affichés
 * sur /content/storytelling). La détection de chevauchement entre rangs se
 * fait côté form/UI, pas dans ce schéma — un rang isolé est validé ici.
 */
const rankBaseSchema = z.object({
  slug: z
    .string()
    .min(1, "Slug requis")
    .max(80)
    .regex(/^[a-z0-9_]+$/, "Slug: uniquement [a-z0-9_]"),
  name: z.string().min(1, "Nom requis").max(120),
  min_level: z.number().int().min(1, "min_level >= 1"),
  max_level: z.number().int().min(1, "max_level >= 1"),
  sort_order: z.number().int().min(0).default(0),
});

const minLeMax = (v: { min_level?: number; max_level?: number }) =>
  v.min_level === undefined || v.max_level === undefined
    ? true
    : v.min_level <= v.max_level;

export const rankSchema = rankBaseSchema.refine(minLeMax, {
  message: "min_level doit être <= max_level",
  path: ["min_level"],
});

export const rankUpdateSchema = rankBaseSchema.partial().refine(minLeMax, {
  message: "min_level doit être <= max_level",
  path: ["min_level"],
});

export type RankInput = z.infer<typeof rankSchema>;
export type RankUpdateInput = z.infer<typeof rankUpdateSchema>;
