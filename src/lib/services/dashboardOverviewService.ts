import { createClient } from "@/lib/supabase/client";
import {
  getSalesCount,
  getSalesTotal,
  getDailyCashbackStats,
  getDailyRevenueStats,
  getUnspentCashbackTotal,
} from "@/lib/services/analyticsService";
import { getClockDrift } from "@/lib/services/reconciliationHealthService";
import { getPeriodConfigs } from "@/lib/services/rewardService";
import { getPeriodIdentifier } from "@/lib/utils";

/**
 * Aggregator service for the new pilotage-style dashboard. Each section has its
 * own async fetcher so the UI can run them in parallel via TanStack Query and
 * surface loading/error states independently.
 */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const CLOCK_DRIFT_ALERT_S = 30;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function todayISO(): string {
  return new Date().toISOString();
}

// ============================================================================
// Section 1 — Alertes
// ============================================================================

export interface DashboardAlerts {
  orphans7d: number;
  cancelledMatch7d: number;
  pendingDistributions: number;
  clockDriftEstablishments: number;
}

export async function getDashboardAlerts(): Promise<DashboardAlerts> {
  const supabase = createClient();
  const sevenDaysAgo = isoDaysAgo(7);

  const [orphansRes, cancelledRes, pendingRes, drift] = await Promise.all([
    supabase
      .from("cashpad_reconciliations")
      .select("id", { count: "exact", head: true })
      .eq("status", "orphan_royaume")
      .gte("reconciled_at", sevenDaysAgo),
    supabase
      .from("cashpad_reconciliations")
      .select("id", { count: "exact", head: true })
      .not("cancelled_match_id", "is", null)
      .gte("reconciled_at", sevenDaysAgo),
    supabase
      .from("period_reward_configs")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    getClockDrift(),
  ]);

  if (orphansRes.error) throw orphansRes.error;
  if (cancelledRes.error) throw cancelledRes.error;
  if (pendingRes.error) throw pendingRes.error;

  const clockDriftEstablishments = drift.filter(
    (d) => d.drift_s !== null && Math.abs(d.drift_s) > CLOCK_DRIFT_ALERT_S,
  ).length;

  return {
    orphans7d: orphansRes.count ?? 0,
    cancelledMatch7d: cancelledRes.count ?? 0,
    pendingDistributions: pendingRes.count ?? 0,
    clockDriftEstablishments,
  };
}

// ============================================================================
// Section 2 — Activité 7j (avec trend)
// ============================================================================

export interface ActivityWindow {
  tickets: number;
  ticketsAmount: number; // centimes
  cashbackEarned: number; // centimes
  cashbackSpent: number; // centimes
  couponsDistributed: number;
  newUsers: number;
  badgesAwarded: number;
}

export interface DashboardActivity {
  current: ActivityWindow;
  previous: ActivityWindow;
}

async function fetchActivityWindow(
  startISO: string,
  endISO: string,
): Promise<ActivityWindow> {
  const supabase = createClient();

  const [
    tickets,
    ticketsAmount,
    cashbackDaily,
    couponsRes,
    newUsersRes,
    badgesRes,
  ] = await Promise.all([
    getSalesCount(startISO, endISO),
    getSalesTotal(startISO, endISO),
    getDailyCashbackStats(startISO, endISO),
    supabase
      .from("coupon_distribution_logs")
      .select("id", { count: "exact", head: true })
      .gte("distributed_at", startISO)
      .lt("distributed_at", endISO),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "client")
      .eq("is_test", false)
      .gte("created_at", startISO)
      .lt("created_at", endISO),
    supabase
      .from("user_badges")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startISO)
      .lt("created_at", endISO),
  ]);

  if (couponsRes.error) throw couponsRes.error;
  if (newUsersRes.error) throw newUsersRes.error;
  if (badgesRes.error) throw badgesRes.error;

  const cashbackEarned = cashbackDaily.reduce(
    (sum, d) => sum + d.creditedOrganic + d.creditedRewards,
    0,
  );
  const cashbackSpent = cashbackDaily.reduce((sum, d) => sum + d.spent, 0);

  return {
    tickets,
    ticketsAmount,
    cashbackEarned,
    cashbackSpent,
    couponsDistributed: couponsRes.count ?? 0,
    newUsers: newUsersRes.count ?? 0,
    badgesAwarded: badgesRes.count ?? 0,
  };
}

export async function getDashboardActivity(): Promise<DashboardActivity> {
  const now = Date.now();
  const startCurrent = new Date(now - SEVEN_DAYS_MS).toISOString();
  const endCurrent = new Date(now).toISOString();
  const startPrevious = new Date(now - 2 * SEVEN_DAYS_MS).toISOString();
  const endPrevious = startCurrent;

  const [current, previous] = await Promise.all([
    fetchActivityWindow(startCurrent, endCurrent),
    fetchActivityWindow(startPrevious, endPrevious),
  ]);

  return { current, previous };
}

// ============================================================================
// Section 3 — État du jeu
// ============================================================================

export interface TopQuest {
  questId: number;
  title: string;
  completions: number;
}

export interface DashboardGameState {
  weeklyActiveQuestsCount: number;
  topQuestsThisWeek: TopQuest[];
  engagementRate: number; // 0–100, % clients ayant ≥ 1 quête complétée cette semaine
  nextDistribution: { periodType: string; periodIdentifier: string } | null;
}

export async function getDashboardGameState(): Promise<DashboardGameState> {
  const supabase = createClient();
  const currentWeek = getPeriodIdentifier("weekly");

  const [activeWeeklyRes, weeklyProgressRes, totalClientsRes, configs] =
    await Promise.all([
      supabase
        .from("quests")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("period_type", "weekly"),
      supabase
        .from("quest_progress")
        .select("quest_id, customer_id, status, quests(name)")
        .eq("period_type", "weekly")
        .eq("period_identifier", currentWeek)
        .eq("status", "completed"),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "client")
        .eq("is_test", false),
      getPeriodConfigs(),
    ]);

  if (activeWeeklyRes.error) throw activeWeeklyRes.error;
  if (weeklyProgressRes.error) throw weeklyProgressRes.error;
  if (totalClientsRes.error) throw totalClientsRes.error;

  type ProgressRow = {
    quest_id: number;
    customer_id: string;
    status: string;
    quests: { name: string } | null;
  };
  const progress = (weeklyProgressRes.data ?? []) as ProgressRow[];

  // Top 3 quests by completion count
  const byQuest = new Map<number, { title: string; completions: number }>();
  for (const row of progress) {
    const existing = byQuest.get(row.quest_id);
    if (existing) {
      existing.completions += 1;
    } else {
      byQuest.set(row.quest_id, {
        title: row.quests?.name ?? `Quête #${row.quest_id}`,
        completions: 1,
      });
    }
  }
  const topQuestsThisWeek: TopQuest[] = Array.from(byQuest.entries())
    .map(([questId, v]) => ({ questId, title: v.title, completions: v.completions }))
    .sort((a, b) => b.completions - a.completions)
    .slice(0, 3);

  // Engagement: % of clients with at least 1 completed quest this week
  const engagedClients = new Set(progress.map((p) => p.customer_id)).size;
  const totalClients = totalClientsRes.count ?? 0;
  const engagementRate =
    totalClients > 0 ? Math.round((engagedClients / totalClients) * 1000) / 10 : 0;

  // Next pending distribution (oldest pending period)
  const pending = configs
    .filter((c) => c.status === "pending")
    .sort((a, b) => a.period_identifier.localeCompare(b.period_identifier));
  const next = pending[0];
  const nextDistribution = next
    ? { periodType: next.period_type, periodIdentifier: next.period_identifier }
    : null;

  return {
    weeklyActiveQuestsCount: activeWeeklyRes.count ?? 0,
    topQuestsThisWeek,
    engagementRate,
    nextDistribution,
  };
}

// ============================================================================
// Section 4 — Santé financière
// ============================================================================

export interface DashboardFinancialHealth {
  pdbDebt: number; // centimes — somme cashback_available
  pdbNetFlow7d: number; // centimes — earned - spent sur 7j
  pdbShareOfRevenue7d: number; // 0–100, % du CA payé en PdB sur 7j
}

export async function getDashboardFinancialHealth(): Promise<DashboardFinancialHealth> {
  const startISO = isoDaysAgo(7);
  const endISO = todayISO();

  const [pdbDebt, cashbackDaily, revenueDaily] = await Promise.all([
    getUnspentCashbackTotal(),
    getDailyCashbackStats(startISO, endISO),
    getDailyRevenueStats(startISO, endISO),
  ]);

  const earned = cashbackDaily.reduce(
    (sum, d) => sum + d.creditedOrganic + d.creditedRewards,
    0,
  );
  const spent = cashbackDaily.reduce((sum, d) => sum + d.spent, 0);
  const pdbNetFlow7d = earned - spent;

  const card = revenueDaily.reduce((s, d) => s + d.card, 0);
  const cash = revenueDaily.reduce((s, d) => s + d.cash, 0);
  const pdb = revenueDaily.reduce((s, d) => s + d.pdbSpent, 0);
  const gross = card + cash + pdb;
  const pdbShareOfRevenue7d =
    gross > 0 ? Math.round((pdb / gross) * 1000) / 10 : 0;

  return { pdbDebt, pdbNetFlow7d, pdbShareOfRevenue7d };
}
