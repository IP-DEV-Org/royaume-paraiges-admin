import { createClient } from "@/lib/supabase/client";
import type {
  Quest,
  QuestInsert,
  QuestUpdate,
  QuestWithRelations,
  QuestCompletionLog,
  QuestPeriod,
  QuestPeriodInsert,
  QuestEstablishmentInsert,
  QuestIteration,
  QuestIterationInsert,
  PeriodType,
  QuestType,
} from "@/types/database";
import {
  questSchema,
  questUpdateSchema,
  questIterationsArraySchema,
  type QuestIterationInput,
} from "@/lib/schemas/quest.schema";

// CRUD Quests
export async function getQuests(periodType?: PeriodType): Promise<QuestWithRelations[]> {
  const supabase = createClient();
  let query = supabase
    .from("quests")
    .select("*, coupon_templates(name, amount, percentage), badge_types(name), quest_periods(*)")
    .order("period_type")
    .order("display_order");

  if (periodType) {
    query = query.eq("period_type", periodType);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as QuestWithRelations[];
}

export async function getActiveQuests(periodType?: PeriodType): Promise<QuestWithRelations[]> {
  const supabase = createClient();
  let query = supabase
    .from("quests")
    .select("*, coupon_templates(name, amount, percentage), badge_types(name), quest_periods(*)")
    .eq("is_active", true)
    .order("period_type")
    .order("display_order");

  if (periodType) {
    query = query.eq("period_type", periodType);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as QuestWithRelations[];
}

export async function getQuest(id: number): Promise<QuestWithRelations | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quests")
    .select(
      "*, coupon_templates(name, amount, percentage), badge_types(name), quest_periods(*), quest_iterations(*)"
    )
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as QuestWithRelations | null;
}

export async function createQuest(quest: QuestInsert): Promise<Quest> {
  questSchema.parse(quest);
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quests")
    .insert(quest as never)
    .select()
    .single();

  if (error) throw error;
  return data as Quest;
}

export async function updateQuest(id: number, quest: QuestUpdate): Promise<Quest> {
  questUpdateSchema.parse(quest);
  const supabase = createClient();
  const payload: QuestUpdate = { ...quest, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("quests")
    .update(payload as never)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Quest;
}

export async function deleteQuest(id: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("quests").delete().eq("id", id);

  if (error) throw error;
}

export async function toggleQuestActive(id: number, isActive: boolean): Promise<void> {
  const supabase = createClient();
  const payload: QuestUpdate = { is_active: isActive, updated_at: new Date().toISOString() };
  const { error } = await supabase
    .from("quests")
    .update(payload as never)
    .eq("id", id);

  if (error) throw error;
}

function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

async function findAvailableDuplicateSlug(baseSlug: string): Promise<string> {
  const normalized = normalizeSlug(baseSlug);
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quests")
    .select("slug")
    .like("slug", `${normalized}_duplicate%`);

  if (error) throw error;

  const existing = new Set(((data || []) as { slug: string }[]).map((r) => r.slug));
  const candidate = `${normalized}_duplicate`;
  if (!existing.has(candidate)) return candidate;

  let i = 2;
  while (existing.has(`${normalized}_duplicate_${i}`)) i++;
  return `${normalized}_duplicate_${i}`;
}

export async function duplicateQuest(id: number): Promise<Quest> {
  const original = await getQuest(id);
  if (!original) throw new Error("Quête introuvable");

  const newSlug = await findAvailableDuplicateSlug(original.slug);

  const insertPayload: QuestInsert = {
    name: original.name,
    description: original.description,
    lore: original.lore,
    slug: newSlug,
    quest_type: original.quest_type,
    consumption_type: original.consumption_type,
    target_value: original.target_value,
    period_type: original.period_type,
    coupon_template_id: original.coupon_template_id,
    badge_type_id: original.badge_type_id,
    bonus_xp: original.bonus_xp,
    bonus_cashback: original.bonus_cashback,
    display_order: original.display_order,
    is_active: false,
    is_repeatable: original.is_repeatable,
  };

  const created = await createQuest(insertPayload);

  const periodIdentifiers = (original.quest_periods || []).map((p) => p.period_identifier);
  if (periodIdentifiers.length > 0) {
    await setQuestPeriods(created.id, periodIdentifiers);
  }

  const establishmentIds = await getQuestEstablishments(id);
  if (establishmentIds.length > 0) {
    await setQuestEstablishments(created.id, establishmentIds);
  }

  const iterations = (original.quest_iterations || []).map((it) => ({
    iteration: it.iteration,
    target_value: it.target_value,
    coupon_template_id: it.coupon_template_id,
    bonus_xp: it.bonus_xp,
    bonus_cashback: it.bonus_cashback,
  }));
  if (iterations.length > 0) {
    await setQuestIterations(created.id, iterations);
  }

  return created;
}

// Quest Completion Logs (for analytics)
export async function getQuestCompletions(
  periodIdentifier?: string
): Promise<QuestCompletionLog[]> {
  const supabase = createClient();
  let query = supabase
    .from("quest_completion_logs")
    .select("*")
    .order("completed_at", { ascending: false });

  if (periodIdentifier) {
    query = query.eq("period_identifier", periodIdentifier);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as QuestCompletionLog[];
}

export async function getQuestCompletionsByQuest(questId: number): Promise<QuestCompletionLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quest_completion_logs")
    .select("*")
    .eq("quest_id", questId)
    .order("completed_at", { ascending: false });

  if (error) throw error;
  return (data || []) as QuestCompletionLog[];
}

// RPC functions
export async function distributeQuestReward(questProgressId: number) {
  const supabase = createClient();

  const { data, error } = await (supabase.rpc as any)("distribute_quest_reward", {
    p_quest_progress_id: questProgressId,
  });

  if (error) throw error;
  return data;
}

export async function distributeAllQuestRewards(adminId?: string) {
  const supabase = createClient();
   
  const { data, error } = await (supabase.rpc as any)("distribute_all_quest_rewards", {
    p_admin_id: adminId,
  });

  if (error) throw error;
  return data;
}

export async function getUserQuests(customerId: string, periodType?: PeriodType) {
  const supabase = createClient();
   
  const { data, error } = await (supabase.rpc as any)("get_user_quests", {
    p_customer_id: customerId,
    p_period_type: periodType || null,
  });

  if (error) throw error;
  return data;
}

// Stats
export interface QuestStats {
  totalQuests: number;
  activeQuests: number;
  totalCompletions: number;
  completionsByPeriod: {
    weekly: number;
    monthly: number;
    yearly: number;
  };
  totalRewardsDistributed: {
    coupons: number;
    badges: number;
    bonusXp: number;
    bonusCashback: number;
  };
}

export async function getQuestStats(): Promise<QuestStats> {
  const supabase = createClient();

  // Get quest counts
  const { data: quests } = await supabase
    .from("quests")
    .select("id, is_active, period_type");

  // Get completion logs
  const { data: completions } = await supabase
    .from("quest_completion_logs")
    .select("period_type, coupon_id, badge_awarded_id, bonus_xp_awarded, bonus_cashback_awarded");

  const questsData = (quests || []) as { id: number; is_active: boolean; period_type: string }[];
  const completionsData = (completions || []) as {
    period_type: string;
    coupon_id: number | null;
    badge_awarded_id: number | null;
    bonus_xp_awarded: number;
    bonus_cashback_awarded: number;
  }[];

  return {
    totalQuests: questsData.length,
    activeQuests: questsData.filter((q) => q.is_active).length,
    totalCompletions: completionsData.length,
    completionsByPeriod: {
      weekly: completionsData.filter((c) => c.period_type === "weekly").length,
      monthly: completionsData.filter((c) => c.period_type === "monthly").length,
      yearly: completionsData.filter((c) => c.period_type === "yearly").length,
    },
    totalRewardsDistributed: {
      coupons: completionsData.filter((c) => c.coupon_id !== null).length,
      badges: completionsData.filter((c) => c.badge_awarded_id !== null).length,
      bonusXp: completionsData.reduce((sum, c) => sum + (c.bonus_xp_awarded || 0), 0),
      bonusCashback: completionsData.reduce((sum, c) => sum + (c.bonus_cashback_awarded || 0), 0),
    },
  };
}

// Quest Periods Management
export async function getQuestPeriods(questId: number): Promise<QuestPeriod[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quest_periods")
    .select("*")
    .eq("quest_id", questId)
    .order("period_identifier");

  if (error) throw error;
  return (data || []) as QuestPeriod[];
}

export async function setQuestPeriods(questId: number, periodIdentifiers: string[]): Promise<void> {
  const supabase = createClient();

  // Supprimer les périodes existantes
  const { error: deleteError } = await supabase
    .from("quest_periods")
    .delete()
    .eq("quest_id", questId);

  if (deleteError) throw deleteError;

  // Ajouter les nouvelles périodes si la liste n'est pas vide
  if (periodIdentifiers.length > 0) {
    const periodsToInsert: QuestPeriodInsert[] = periodIdentifiers.map((period) => ({
      quest_id: questId,
      period_identifier: period,
    }));

    const { error: insertError } = await supabase
      .from("quest_periods")
      .insert(periodsToInsert as never);

    if (insertError) throw insertError;
  }
}

export async function addQuestPeriod(questId: number, periodIdentifier: string): Promise<QuestPeriod> {
  const supabase = createClient();
  const payload: QuestPeriodInsert = { quest_id: questId, period_identifier: periodIdentifier };
  const { data, error } = await supabase
    .from("quest_periods")
    .insert(payload as never)
    .select()
    .single();

  if (error) throw error;
  return data as QuestPeriod;
}

export async function removeQuestPeriod(questId: number, periodIdentifier: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("quest_periods")
    .delete()
    .eq("quest_id", questId)
    .eq("period_identifier", periodIdentifier);

  if (error) throw error;
}

// ---------------------------------------------------------------------
// Quest <-> Establishment M2M (migration 020)
// Aucune entrée pour une quête = quête globale (applicable à tous les
// établissements). ≥ 1 entrée = quête locale. Les triggers de la migration
// 021 bloquent toute redondance de signature (errcode P0421).
// ---------------------------------------------------------------------

export async function getQuestEstablishments(questId: number): Promise<number[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quests_establishments")
    .select("establishment_id")
    .eq("quest_id", questId);

  if (error) throw error;
  return ((data || []) as { establishment_id: number }[]).map((r) => r.establishment_id);
}

/**
 * Remplace les liens établissements d'une quête (DELETE + INSERT).
 * Passer un tableau vide remet la quête en « globale ».
 *
 * Peut lever une erreur P0421 (quest redundancy) : utiliser
 * `parseQuestRedundancyError` pour extraire le DETAIL JSON.
 */
export async function setQuestEstablishments(
  questId: number,
  establishmentIds: number[]
): Promise<void> {
  const supabase = createClient();

  const { error: deleteError } = await supabase
    .from("quests_establishments")
    .delete()
    .eq("quest_id", questId);

  if (deleteError) throw deleteError;

  if (establishmentIds.length > 0) {
    const rows: QuestEstablishmentInsert[] = establishmentIds.map((id) => ({
      quest_id: questId,
      establishment_id: id,
    }));
    const { error: insertError } = await supabase
      .from("quests_establishments")
      .insert(rows as never);

    if (insertError) throw insertError;
  }
}

// ---------------------------------------------------------------------
// Quest iterations — overrides par itération des quêtes répétables
// (migration 066). Itération 1 = la quête elle-même ; les lignes couvrent
// les itérations >= 2. Chaque champ NULL hérite de la quête de base.
// ---------------------------------------------------------------------

export async function getQuestIterations(questId: number): Promise<QuestIteration[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quest_iterations")
    .select("*")
    .eq("quest_id", questId)
    .order("iteration");

  if (error) throw error;
  return (data || []) as QuestIteration[];
}

/**
 * Remplace les overrides d'itérations d'une quête (DELETE + INSERT).
 * Passer un tableau vide supprime tous les overrides (toutes les itérations
 * héritent alors de la quête de base).
 */
export async function setQuestIterations(
  questId: number,
  iterations: QuestIterationInput[]
): Promise<void> {
  questIterationsArraySchema.parse(iterations);
  const supabase = createClient();

  const { error: deleteError } = await supabase
    .from("quest_iterations")
    .delete()
    .eq("quest_id", questId);

  if (deleteError) throw deleteError;

  if (iterations.length > 0) {
    const rows: QuestIterationInsert[] = iterations.map((it) => ({
      quest_id: questId,
      iteration: it.iteration,
      target_value: it.target_value ?? null,
      coupon_template_id: it.coupon_template_id ?? null,
      bonus_xp: it.bonus_xp ?? null,
      bonus_cashback: it.bonus_cashback ?? null,
    }));
    const { error: insertError } = await supabase
      .from("quest_iterations")
      .insert(rows as never);

    if (insertError) throw insertError;
  }
}

// CSV Export/Import

const CSV_HEADERS = [
  "name",
  "description",
  "lore",
  "slug",
  "quest_type",
  "target_value",
  "period_type",
  "coupon_template_id",
  "bonus_xp",
  "bonus_cashback",
  "display_order",
  "is_active",
  "periods",
] as const;

export type QuestCsvRow = {
  name: string;
  description: string;
  lore: string;
  slug: string;
  quest_type: string;
  target_value: string;
  period_type: string;
  coupon_template_id: string;
  bonus_xp: string;
  bonus_cashback: string;
  display_order: string;
  is_active: string;
  periods: string;
};

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function generateQuestsCsvTemplate(): string {
  const lines: string[] = [];
  lines.push(CSV_HEADERS.join(","));

  // Example rows
  lines.push(
    [
      "Habitué de la semaine",
      "Passez 3 commandes cette semaine",
      "",
      "habitue_semaine",
      "orders_count",
      "3",
      "weekly",
      "",
      "50",
      "0",
      "1",
      "true",
      "",
    ].map(escapeCSV).join(",")
  );
  lines.push(
    [
      "Collectionneur du mois",
      "Collecte 50 Paraiges de Bronze ce mois-ci",
      "",
      "collectionneur_mois",
      "cashback_earned",
      "50",
      "monthly",
      "",
      "100",
      "2.50",
      "2",
      "true",
      "",
    ].map(escapeCSV).join(",")
  );
  lines.push(
    [
      "Explorateur annuel",
      "Visitez 5 établissements cette année",
      "",
      "explorateur_annuel",
      "establishments_visited",
      "5",
      "yearly",
      "",
      "200",
      "5",
      "3",
      "true",
      "",
    ].map(escapeCSV).join(",")
  );
  lines.push(
    [
      "Quêteur assidu",
      "Complétez au moins 1 quête hebdo pendant 4 semaines",
      "",
      "queteur_assidu",
      "quest_completed",
      "4",
      "monthly",
      "",
      "100",
      "1",
      "4",
      "true",
      "",
    ].map(escapeCSV).join(",")
  );

  return lines.join("\n");
}

export function exportQuestsToCsv(quests: QuestWithRelations[]): string {
  const lines: string[] = [];
  lines.push(CSV_HEADERS.join(","));

  for (const quest of quests) {
    const periods = (quest.quest_periods || [])
      .map((p) => p.period_identifier)
      .sort()
      .join(";");

    const targetValue =
      quest.quest_type === "amount_spent"
        ? (quest.target_value / 100).toString()
        : quest.target_value.toString();

    const bonusCashback = (quest.bonus_cashback / 100).toString();

    lines.push(
      [
        quest.name,
        quest.description || "",
        quest.lore || "",
        quest.slug,
        quest.quest_type,
        targetValue,
        quest.period_type,
        quest.coupon_template_id?.toString() || "",
        quest.bonus_xp.toString(),
        bonusCashback,
        quest.display_order.toString(),
        quest.is_active ? "true" : "false",
        periods,
      ].map(escapeCSV).join(",")
    );
  }

  return lines.join("\n");
}

export function parseQuestsCsv(csvContent: string): { rows: QuestCsvRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: QuestCsvRow[] = [];

  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) {
    errors.push("Le fichier CSV doit contenir au moins un en-tête et une ligne de données.");
    return { rows, errors };
  }

  // Parse header
  const firstLine = lines[0];
  if (!firstLine) {
    errors.push("Le fichier CSV est vide.");
    return { rows, errors };
  }
  const headers = parseCsvLine(firstLine);
  const headerMap = new Map<string, number>();
  headers.forEach((h, i) => headerMap.set(h.trim().toLowerCase(), i));

  // Validate required headers
  const requiredHeaders = ["name", "quest_type", "target_value", "period_type"];
  for (const rh of requiredHeaders) {
    if (!headerMap.has(rh)) {
      errors.push(`Colonne requise manquante : "${rh}"`);
    }
  }
  if (errors.length > 0) return { rows, errors };

  const validQuestTypes = ["xp_earned", "amount_spent", "cashback_earned", "establishments_visited", "orders_count", "quest_completed", "consumption_count"];
  const validPeriodTypes = ["weekly", "monthly", "yearly"];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine === undefined) continue;
    const values = parseCsvLine(rawLine);
    const get = (col: string) => {
      const idx = headerMap.get(col);
      return idx !== undefined && idx < values.length ? (values[idx] ?? "").trim() : "";
    };

    const name = get("name");
    if (!name) {
      errors.push(`Ligne ${i + 1} : le nom est requis.`);
      continue;
    }

    const questType = get("quest_type");
    if (!validQuestTypes.includes(questType)) {
      errors.push(`Ligne ${i + 1} : quest_type invalide "${questType}". Valeurs : ${validQuestTypes.join(", ")}`);
      continue;
    }

    const targetValue = get("target_value");
    if (!targetValue || isNaN(Number(targetValue))) {
      errors.push(`Ligne ${i + 1} : target_value invalide "${targetValue}".`);
      continue;
    }

    const periodType = get("period_type");
    if (!validPeriodTypes.includes(periodType)) {
      errors.push(`Ligne ${i + 1} : period_type invalide "${periodType}". Valeurs : ${validPeriodTypes.join(", ")}`);
      continue;
    }

    const bonusXp = get("bonus_xp");
    if (bonusXp && isNaN(Number(bonusXp))) {
      errors.push(`Ligne ${i + 1} : bonus_xp invalide "${bonusXp}".`);
      continue;
    }

    const bonusCashback = get("bonus_cashback");
    if (bonusCashback && isNaN(Number(bonusCashback))) {
      errors.push(`Ligne ${i + 1} : bonus_cashback invalide "${bonusCashback}".`);
      continue;
    }

    rows.push({
      name,
      description: get("description"),
      lore: get("lore"),
      slug: get("slug") || generateSlug(name),
      quest_type: questType,
      target_value: targetValue,
      period_type: periodType,
      coupon_template_id: get("coupon_template_id"),
      bonus_xp: bonusXp || "0",
      bonus_cashback: bonusCashback || "0",
      display_order: get("display_order") || "0",
      is_active: get("is_active") !== "false" ? "true" : "false",
      periods: get("periods"),
    });
  }

  return { rows, errors };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

export async function importQuestsFromCsv(
  rows: QuestCsvRow[]
): Promise<{ created: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    try {
      // Convert target_value: euros → centimes for amount_spent
      const targetValue =
        row.quest_type === "amount_spent"
          ? Math.round(parseFloat(row.target_value) * 100)
          : parseInt(row.target_value);

      const questData: QuestInsert = {
        name: row.name,
        description: row.description || null,
        lore: row.lore || null,
        slug: row.slug,
        quest_type: row.quest_type as QuestType,
        target_value: targetValue,
        period_type: row.period_type,
        coupon_template_id: row.coupon_template_id
          ? parseInt(row.coupon_template_id)
          : null,
        bonus_xp: parseInt(row.bonus_xp) || 0,
        bonus_cashback: Math.round(parseFloat(row.bonus_cashback) * 100) || 0,
        display_order: parseInt(row.display_order) || 0,
        is_active: row.is_active === "true",
      };

      const createdQuest = await createQuest(questData);

      // Set periods if specified (semicolon-separated)
      if (row.periods) {
        const periodIdentifiers = row.periods
          .split(";")
          .map((p) => p.trim())
          .filter(Boolean);
        if (periodIdentifiers.length > 0) {
          await setQuestPeriods(createdQuest.id, periodIdentifiers);
        }
      }

      created++;
    } catch (error) {
      errors.push(
        `"${row.name}" : ${error instanceof Error ? error.message : "Erreur inconnue"}`
      );
    }
  }

  return { created, errors };
}

// Quest Progress Stats (for archived quests)
export interface QuestProgressStats {
  quest_id: number;
  in_progress: number;
  completed: number;
  rewarded: number;
  expired: number;
  total: number;
}

export async function getQuestProgressStatsByQuests(
  questIds: number[]
): Promise<Map<number, QuestProgressStats>> {
  if (questIds.length === 0) return new Map();

  const supabase = createClient();
  const { data, error } = await supabase
    .from("quest_progress")
    .select("quest_id, status")
    .in("quest_id", questIds);

  if (error) throw error;

  const statsMap = new Map<number, QuestProgressStats>();

  for (const questId of questIds) {
    statsMap.set(questId, {
      quest_id: questId,
      in_progress: 0,
      completed: 0,
      rewarded: 0,
      expired: 0,
      total: 0,
    });
  }

  for (const row of (data || []) as { quest_id: number; status: string }[]) {
    const stats = statsMap.get(row.quest_id);
    if (stats && row.status in stats) {
      const statsRecord = stats as unknown as Record<string, number>;
      statsRecord[row.status] = (statsRecord[row.status] ?? 0) + 1;
      stats.total++;
    }
  }

  return statsMap;
}

// Stats de participation scopées à une période précise (quest_progress.period_identifier).
// Utilisé par /quests pour afficher la performance d'une quête sur une période passée.
export async function getQuestProgressStatsForPeriod(
  questIds: number[],
  periodIdentifier: string
): Promise<Map<number, QuestProgressStats>> {
  if (questIds.length === 0) return new Map();

  const supabase = createClient();
  const { data, error } = await supabase
    .from("quest_progress")
    .select("quest_id, status")
    .in("quest_id", questIds)
    .eq("period_identifier", periodIdentifier);

  if (error) throw error;

  const statsMap = new Map<number, QuestProgressStats>();
  for (const questId of questIds) {
    statsMap.set(questId, {
      quest_id: questId,
      in_progress: 0,
      completed: 0,
      rewarded: 0,
      expired: 0,
      total: 0,
    });
  }

  for (const row of (data || []) as { quest_id: number; status: string }[]) {
    const stats = statsMap.get(row.quest_id);
    if (stats && row.status in stats) {
      const statsRecord = stats as unknown as Record<string, number>;
      statsRecord[row.status] = (statsRecord[row.status] ?? 0) + 1;
      stats.total++;
    }
  }

  return statsMap;
}

// Récupérer les quêtes actives pour une période spécifique
export async function getQuestsForPeriod(
  periodType: PeriodType,
  periodIdentifier: string
): Promise<QuestWithRelations[]> {
  const supabase = createClient();

  // Récupérer toutes les quêtes actives du bon type de période
  const { data: quests, error } = await supabase
    .from("quests")
    .select("*, coupon_templates(name, amount, percentage), badge_types(name), quest_periods(*)")
    .eq("period_type", periodType)
    .eq("is_active", true)
    .order("display_order");

  if (error) throw error;

  const questsData = (quests || []) as QuestWithRelations[];

  // Filtrer: garder les quêtes qui n'ont pas de période assignée OU qui sont assignées à cette période
  return questsData.filter((quest) => {
    const periods = quest.quest_periods || [];
    // Si aucune période assignée, la quête est active pour toutes les périodes
    if (periods.length === 0) return true;
    // Sinon, vérifier si cette période est dans la liste
    return periods.some((p) => p.period_identifier === periodIdentifier);
  });
}
