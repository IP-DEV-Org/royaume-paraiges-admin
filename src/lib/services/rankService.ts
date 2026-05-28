/**
 * Service `ranks` — CRUD des groupes de niveaux affichés sur la page
 * storytelling admin (/content/storytelling). Validation Zod systématique
 * sur les writes.
 */

import { createClient } from "@/lib/supabase/client";
import type { Rank } from "@/types/database";
import {
  rankSchema,
  rankUpdateSchema,
  type RankInput,
  type RankUpdateInput,
} from "@/lib/schemas/rank.schema";

export async function getRanks(): Promise<Rank[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ranks")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Rank[];
}

export async function createRank(input: RankInput): Promise<Rank> {
  const payload = rankSchema.parse(input);
  const supabase = createClient();
  const { data, error } = await (supabase.from("ranks") as any)
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as Rank;
}

export async function updateRank(id: number, input: RankUpdateInput): Promise<Rank> {
  const payload = rankUpdateSchema.parse(input);
  const supabase = createClient();
  const { data, error } = await (supabase.from("ranks") as any)
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Rank;
}

export async function deleteRank(id: number): Promise<void> {
  const supabase = createClient();
  const { error } = await (supabase.from("ranks") as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Retourne le rang correspondant à un niveau donné. Si plusieurs rangs
 * matchent (chevauchement), prend celui avec le plus petit `sort_order`.
 * Si aucun ne matche, retourne `null` — l'UI affiche un placeholder.
 */
export function getRankForLevel(level: number, ranks: Rank[]): Rank | null {
  const matching = ranks
    .filter((r) => level >= r.min_level && level <= r.max_level)
    .sort((a, b) => a.sort_order - b.sort_order);
  return matching[0] ?? null;
}
