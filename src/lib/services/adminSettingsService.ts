import { createClient } from "@/lib/supabase/client";
import type { AdminSetting } from "@/types/database";

/**
 * Accès à la table `admin_settings` (migration 020). RLS admin-only : le
 * contrôle d'accès est délégué à PostgreSQL, pas de vérification ici.
 */

// Clés typées connues de la PR prévention quêtes redondantes
export const SETTING_KEYS = {
  QUEST_ALERT_RATIO_PCT: "quest_alert_ratio_pct",
  QUEST_REFERENCE_PRICES_CENTS: "quest_reference_prices_cents",
  QUEST_REPEAT_LEVEL_TIERS: "quest_repeat_level_tiers",
} as const;

/**
 * Palier du barème manuel « répétition des défis par niveau » (migration 066).
 * Le palier de plus haut min_level atteint par le joueur s'applique.
 */
export type QuestRepeatLevelTier = {
  min_level: number;
  max_completions: number;
};

/**
 * Configuration de répétition des défis (migration 068, bimodale) :
 * - "auto" (défaut) : plafond lié au rang du joueur (rang N → N complétions,
 *   suit dynamiquement la table `ranks`) ;
 * - "manual" : barème explicite par niveau (tableau de paliers).
 */
export type QuestRepeatConfig =
  | { mode: "auto" }
  | { mode: "manual"; tiers: QuestRepeatLevelTier[] };

export const DEFAULT_QUEST_REPEAT_LEVEL_TIERS: QuestRepeatLevelTier[] = [
  { min_level: 1, max_completions: 1 },
];

export type QuestReferencePrices = {
  biere?: number;
  cocktail?: number;
  alcool?: number;
  soft?: number;
  boisson_chaude?: number;
  restauration?: number;
};

export async function getAllAdminSettings(): Promise<AdminSetting[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("admin_settings")
    .select("*")
    .order("key");
  if (error) throw error;
  return (data || []) as AdminSetting[];
}

export async function getAdminSetting(key: string): Promise<AdminSetting | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("admin_settings")
    .select("*")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return (data as AdminSetting | null) ?? null;
}

export async function updateAdminSetting(key: string, value: unknown): Promise<AdminSetting> {
  const supabase = createClient();
  const payload = { value: value as never, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("admin_settings")
    .update(payload as never)
    .eq("key", key)
    .select()
    .single();
  if (error) throw error;
  return data as AdminSetting;
}

/**
 * Helper typé : récupère le seuil de ratio en pourcentage (entier).
 * Fallback 10 si la clé n'existe pas ou si la valeur est invalide.
 */
export async function getQuestAlertRatioPct(): Promise<number> {
  const setting = await getAdminSetting(SETTING_KEYS.QUEST_ALERT_RATIO_PCT);
  const raw = setting?.value;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  return 10;
}

/**
 * Helper typé : récupère le dict de prix de référence par consumption_type
 * (valeurs en centimes). Fallback vide si la clé n'existe pas.
 */
export async function getQuestReferencePrices(): Promise<QuestReferencePrices> {
  const setting = await getAdminSetting(SETTING_KEYS.QUEST_REFERENCE_PRICES_CENTS);
  if (!setting || !setting.value || typeof setting.value !== "object") return {};
  return setting.value as QuestReferencePrices;
}

/**
 * Helper typé : configuration de répétition des défis (migration 068).
 * Un tableau de paliers valide et non vide = barème manuel ; tout le reste
 * ("auto", clé absente, valeur invalide) = mode automatique lié aux rangs —
 * même résolution que la fonction SQL get_max_quest_completions.
 */
export async function getQuestRepeatConfig(): Promise<QuestRepeatConfig> {
  const setting = await getAdminSetting(SETTING_KEYS.QUEST_REPEAT_LEVEL_TIERS);
  const raw = setting?.value;

  if (Array.isArray(raw)) {
    const tiers = raw.filter(
      (t): t is QuestRepeatLevelTier =>
        typeof t === "object" &&
        t !== null &&
        typeof (t as QuestRepeatLevelTier).min_level === "number" &&
        typeof (t as QuestRepeatLevelTier).max_completions === "number"
    );
    if (tiers.length > 0) {
      return {
        mode: "manual",
        tiers: [...tiers].sort((a, b) => a.min_level - b.min_level),
      };
    }
  }

  return { mode: "auto" };
}

/**
 * Vue `avg_ticket_12m` (migration 020) — panier moyen en centimes sur les 12
 * derniers mois, hors comptes `is_test`.
 */
export interface AvgTicket12m {
  avg_ticket_cents: number;
  sample_size: number;
}

export async function getAvgTicket12m(): Promise<AvgTicket12m> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("avg_ticket_12m")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { avg_ticket_cents: 0, sample_size: 0 };
  return data as AvgTicket12m;
}
