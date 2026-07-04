import { z } from "zod";

/**
 * Validation des payloads pour la table `redirect_links` (liens courts servis
 * par redirect.auxparaiges.fr, migration 063). Le slug suit le CHECK BDD
 * `ck_redirect_slug_format` ; les cibles iOS/Android sont optionnelles (NULL =
 * la cible par défaut s'applique).
 */
const urlField = z
  .string()
  .min(1, "URL requise")
  .max(2000)
  .regex(/^https?:\/\/\S+$/, "URL invalide (doit commencer par http(s)://)");

const redirectLinkBaseSchema = z.object({
  slug: z
    .string()
    .min(1, "Slug requis")
    .max(60)
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
      "Slug : minuscules, chiffres et tirets, sans tiret en début ou fin",
    ),
  label: z.string().min(1, "Nom requis").max(120),
  description: z.string().max(500).nullable().optional(),
  target_url: urlField,
  target_url_ios: urlField.nullable().optional(),
  target_url_android: urlField.nullable().optional(),
  is_active: z.boolean().default(true),
});

export const redirectLinkSchema = redirectLinkBaseSchema;
export const redirectLinkUpdateSchema = redirectLinkBaseSchema.partial();

export type RedirectLinkInput = z.infer<typeof redirectLinkSchema>;
export type RedirectLinkUpdateInput = z.infer<typeof redirectLinkUpdateSchema>;
