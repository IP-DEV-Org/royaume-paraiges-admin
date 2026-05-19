import { createClient } from "@/lib/supabase/client";

/**
 * Stats agrégées et mappings pour la page Santé du matching Cashpad.
 * Sources : vues SQL `cashpad_health_stats_30d`, `cashpad_window_feedback`,
 * `cashpad_clock_drift`, table `cashpad_employee_mappings`.
 */

export interface EtabHealthStat {
  establishment_id: number;
  establishment_title: string;
  cashpad_installation_id: string;
  n_matched: number;
  n_ambiguous: number;
  n_orphan: number;
  n_excluded: number;
  n_orphan_cancelled_match: number;
  n_total: number;
  match_rate_pct: number | null;
  avg_confidence: number | null;
  current_window_s: number | null;
  current_offset_s: number | null;
  params_sample_size: number | null;
  params_computed_at: string | null;
}

export async function getHealthStats30d(): Promise<EtabHealthStat[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cashpad_health_stats_30d")
    .select("*");
  if (error) throw error;
  return ((data ?? []) as unknown as EtabHealthStat[]).map((r) => ({
    ...r,
    match_rate_pct: r.match_rate_pct === null ? null : Number(r.match_rate_pct),
    avg_confidence: r.avg_confidence === null ? null : Number(r.avg_confidence),
  }));
}

export interface ClockDrift {
  establishment_id: number;
  median_30d_s: number | null;
  median_7d_s: number | null;
  drift_s: number | null;
  n_7d: number | null;
  n_30d: number | null;
}

export async function getClockDrift(): Promise<ClockDrift[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("cashpad_clock_drift").select("*");
  if (error) throw error;
  return (data ?? []) as unknown as ClockDrift[];
}

export interface WindowFeedback {
  establishment_id: number;
  manual_links_total: number;
  manual_links_out_of_window: number;
  current_window_s: number;
  current_offset_s: number;
  suggested_window_p95: number | null;
}

export async function getWindowFeedback(): Promise<WindowFeedback[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cashpad_window_feedback")
    .select("*");
  if (error) throw error;
  return (data ?? []) as unknown as WindowFeedback[];
}

/**
 * Catégorisation des orphans sur les 30 derniers jours.
 * Renvoie un dict catégorie → count.
 */
export interface OrphanCategoryCount {
  establishment_id: number;
  category:
    | "cashpad_cancelled"
    | "amount_mismatch_in_window"
    | "time_skew_5_to_30min"
    | "no_cashpad_at_all";
  n: number;
}

export async function getOrphanCategorization(): Promise<OrphanCategoryCount[]> {
  const supabase = createClient();
  // RPC ou query direct ? Pour simplifier on fait un query qui appelle une fonction PG
  // mais ici on n'a pas créé de fonction → on calcule côté client via les rows.
  // Plus simple : query brut avec EXISTS via raw SQL — pas faisable côté PostgREST.
  // → On ne fait pas la catégorisation pour cette itération, elle restera disponible
  //   en analyse SQL.
  return [];
}

// ============================================================================
// Mappings employé Royaume ↔ utilisateur Cashpad
// ============================================================================

export interface EmployeeMapping {
  id: string;
  profile_id: string;
  installation_id: string;
  cashpad_user_id: string;
  cashpad_user_name: string | null;
  created_at: string;
}

export interface EmployeeMappingWithProfile extends EmployeeMapping {
  profile: {
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export async function listEmployeeMappings(): Promise<EmployeeMappingWithProfile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cashpad_employee_mappings")
    .select(
      "*, profile:profiles!profile_id(id, email, first_name, last_name)",
    )
    .order("installation_id");
  if (error) throw error;
  return (data ?? []) as unknown as EmployeeMappingWithProfile[];
}

export async function createEmployeeMapping(params: {
  profileId: string;
  installationId: string;
  cashpadUserId: string;
  cashpadUserName?: string | null;
}): Promise<EmployeeMapping> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const adminId = userData.user?.id ?? null;

  const { data, error } = await (supabase.from("cashpad_employee_mappings") as any)
    .insert({
      profile_id: params.profileId,
      installation_id: params.installationId,
      cashpad_user_id: params.cashpadUserId,
      cashpad_user_name: params.cashpadUserName ?? null,
      created_by: adminId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as EmployeeMapping;
}

export async function deleteEmployeeMapping(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await (supabase.from("cashpad_employee_mappings") as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Renvoie la liste des `cashpad_user_id` observés sur un établissement
 * (extrait des snapshots), pour aider l'admin à mapper.
 */
export interface CashpadUserSeen {
  cashpad_user_id: string;
  cashpad_user_name: string | null;
  n_tickets: number;
}

export async function listCashpadUsersForInstallation(
  installationId: string,
): Promise<CashpadUserSeen[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cashpad_receipts_snapshot")
    .select("cashpad_user_id, cashpad_user_name")
    .eq("installation_id", installationId)
    .not("cashpad_user_id", "is", null);
  if (error) throw error;
  const agg = new Map<string, CashpadUserSeen>();
  for (const row of (data ?? []) as Array<{
    cashpad_user_id: string;
    cashpad_user_name: string | null;
  }>) {
    const key = row.cashpad_user_id;
    const existing = agg.get(key);
    if (existing) {
      existing.n_tickets += 1;
      if (!existing.cashpad_user_name && row.cashpad_user_name) {
        existing.cashpad_user_name = row.cashpad_user_name;
      }
    } else {
      agg.set(key, {
        cashpad_user_id: key,
        cashpad_user_name: row.cashpad_user_name,
        n_tickets: 1,
      });
    }
  }
  return [...agg.values()].sort((a, b) => b.n_tickets - a.n_tickets);
}

/**
 * Liste les profiles ayant le rôle `employee` (ou `establishment`) — candidats au mapping.
 */
export interface EmployeeProfile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}

export async function listEmployeeCandidates(): Promise<EmployeeProfile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, role")
    .in("role", ["employee", "establishment", "admin"])
    .order("last_name");
  if (error) throw error;
  return ((data ?? []) as Array<EmployeeProfile & { role: string }>).map((p) => ({
    id: p.id,
    email: p.email,
    first_name: p.first_name,
    last_name: p.last_name,
  }));
}
