import { z } from "zod";

export const questTypeSchema = z.enum([
  "xp_earned",
  "cashback_earned",
  "amount_spent",
  "establishments_visited",
  "orders_count",
  "quest_completed",
  "consumption_count",
]);

export const consumptionTypeSchema = z.enum([
  "cocktail",
  "biere",
  "alcool",
  "soft",
  "boisson_chaude",
  "restauration",
  "boucherie",
]);

export const periodTypeSchema = z.enum(["weekly", "monthly", "yearly"]);

/**
 * Override d'une itération de quête répétable (table `quest_iterations`,
 * migration 066). Itération 1 = la quête elle-même ; toute valeur null hérite
 * de la quête de base (target_value / coupon / bonus).
 */
export const questIterationSchema = z.object({
  iteration: z.number().int().min(2),
  target_value: z.number().int().positive().nullish(),
  coupon_template_id: z.number().int().positive().nullish(),
  bonus_xp: z.number().int().min(0).nullish(),
  bonus_cashback: z.number().int().min(0).nullish(),
});

export const questIterationsArraySchema = z
  .array(questIterationSchema)
  .superRefine((iterations, ctx) => {
    const seen = new Set<number>();
    for (const it of iterations) {
      if (seen.has(it.iteration)) {
        ctx.addIssue({
          code: "custom",
          message: `Itération ${it.iteration} définie plusieurs fois`,
        });
      }
      seen.add(it.iteration);
    }
  });

export type QuestIterationInput = z.infer<typeof questIterationSchema>;

/**
 * Validation des payloads d'insert/update sur la table `quests`.
 * Aligné avec les colonnes de la BDD (pas avec le form admin — celui-ci peut avoir des champs calculés).
 */
export const questSchema = z
  .object({
    slug: z
      .string()
      .min(1, "Slug requis")
      .regex(/^[a-z0-9_]+$/, "Slug: uniquement [a-z0-9_]"),
    name: z.string().min(1, "Nom requis").max(200),
    description: z.string().max(1000).nullish(),
    lore: z.string().max(2000).nullish(),
    period_type: periodTypeSchema,
    quest_type: questTypeSchema,
    consumption_type: consumptionTypeSchema.nullish(),
    target_value: z.number().int().positive(),
    bonus_xp: z.number().int().min(0).default(0),
    bonus_cashback: z.number().int().min(0).default(0),
    coupon_template_id: z.number().int().positive().nullish(),
    badge_type_id: z.number().int().positive().nullish(),
    is_active: z.boolean().default(true),
    is_repeatable: z.boolean().default(false),
    display_order: z.number().int().min(0).default(0),
  })
  .superRefine((data, ctx) => {
    if (
      data.quest_type === "consumption_count" &&
      (data.consumption_type === null || data.consumption_type === undefined)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "consumption_type requis quand quest_type = consumption_count",
        path: ["consumption_type"],
      });
    }
    if (
      data.quest_type !== "consumption_count" &&
      data.consumption_type !== null &&
      data.consumption_type !== undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "consumption_type ne doit être renseigné que pour consumption_count",
        path: ["consumption_type"],
      });
    }
    if (data.quest_type === "quest_completed" && data.period_type === "weekly") {
      ctx.addIssue({
        code: "custom",
        message: "quest_completed incompatible avec period_type = weekly",
        path: ["period_type"],
      });
    }
  });

/**
 * Version partielle pour les updates.
 * Ne peut pas faire schema.partial() à cause du superRefine — on duplique proprement.
 */
export const questUpdateSchema = z
  .object({
    slug: z.string().min(1).regex(/^[a-z0-9_]+$/).optional(),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).nullish(),
    lore: z.string().max(2000).nullish(),
    period_type: periodTypeSchema.optional(),
    quest_type: questTypeSchema.optional(),
    consumption_type: consumptionTypeSchema.nullish(),
    target_value: z.number().int().positive().optional(),
    bonus_xp: z.number().int().min(0).optional(),
    bonus_cashback: z.number().int().min(0).optional(),
    coupon_template_id: z.number().int().positive().nullish(),
    badge_type_id: z.number().int().positive().nullish(),
    is_active: z.boolean().optional(),
    is_repeatable: z.boolean().optional(),
    display_order: z.number().int().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    // Cross-field checks uniquement si on peut les évaluer (quest_type connu).
    if (data.quest_type === "consumption_count" && data.consumption_type === null) {
      ctx.addIssue({
        code: "custom",
        message: "consumption_type requis quand quest_type = consumption_count",
        path: ["consumption_type"],
      });
    }
    if (data.quest_type === "quest_completed" && data.period_type === "weekly") {
      ctx.addIssue({
        code: "custom",
        message: "quest_completed incompatible avec period_type = weekly",
        path: ["period_type"],
      });
    }
  });

export type QuestSchemaInput = z.infer<typeof questSchema>;
export type QuestUpdateSchemaInput = z.infer<typeof questUpdateSchema>;
