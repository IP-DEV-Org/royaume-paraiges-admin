import { createClient } from "@/lib/supabase/client";
import type { Database, Rank } from "@/types/database";

export type LevelThreshold = Database["public"]["Tables"]["level_thresholds"]["Row"];

export async function getLevelThresholds(): Promise<LevelThreshold[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("level_thresholds")
    .select("*")
    .order("level", { ascending: true });
  if (error) throw error;
  return data as LevelThreshold[];
}

/**
 * Convertit un niveau en coefficient PdB lisible (ex. niveau 11 → 3,0).
 * Source : règle produit +0,2 par niveau depuis 1,0 au niveau 1.
 */
export function levelToCoefficient(level: number): number {
  return 1 + (level - 1) * 0.2;
}

/**
 * Fallback hardcodé utilisé si la table `ranks` est vide ou indisponible.
 * Reste aligné sur le seed initial (migration `create_ranks_table`).
 */
export function levelToRankName(level: number): string {
  if (level >= 26) return "Chevalier de la Table Ronde";
  if (level >= 21) return "Chevalier";
  if (level >= 16) return "Capitaine";
  if (level >= 11) return "Sergent";
  if (level >= 6) return "Soldat";
  return "Écuyer";
}

/**
 * Résolution dynamique du rang d'un niveau à partir de la table `ranks`.
 * En cas de chevauchement, prend le rang avec le plus petit `sort_order`.
 * Tombe sur `levelToRankName` si aucun rang ne matche.
 */
export function resolveRankName(level: number, ranks: Rank[]): string {
  const matching = ranks
    .filter((r) => level >= r.min_level && level <= r.max_level)
    .sort((a, b) => a.sort_order - b.sort_order);
  return matching[0]?.name ?? levelToRankName(level);
}
