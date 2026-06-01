import { createClient } from "@/lib/supabase/client";

/**
 * Cache des IDs d'utilisateurs test (is_test = true).
 * Utilisé pour les exclure des statistiques côté client.
 */
let _testUserIdsCache: string[] | null = null;

async function getTestUserIds(): Promise<string[]> {
  if (_testUserIdsCache !== null) return _testUserIdsCache;
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_test", true);
  _testUserIdsCache = (data || []).map((p: { id: string }) => p.id);
  return _testUserIdsCache;
}

export interface CouponStats {
  totalCoupons: number;
  activeCoupons: number;
  usedCoupons: number;
  expiredCoupons: number;
  totalValueDistributed: number;
  totalValueUsed: number;
  usageRate: number;
  expirationRate: number;
}

export interface DistributionStats {
  date: string;
  count: number;
  type: string;
}

export interface DailyCashback {
  date: string;
  creditedOrganic: number;
  creditedRewards: number;
  spent: number;
}

export interface DailyRevenue {
  date: string;
  card: number;
  cash: number;
  pdbSpent: number;
}

export async function getCouponStats(): Promise<CouponStats> {
  const supabase = createClient();
   
  const { data, error } = await (supabase.rpc as any)("get_coupon_stats");

  if (error) throw error;
  return data as CouponStats;
}

export async function getDistributionsByPeriod(
  startDate: string,
  endDate: string
): Promise<DistributionStats[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("coupon_distribution_logs")
    .select("distributed_at, distribution_type")
    .gte("distributed_at", startDate)
    .lte("distributed_at", endDate)
    .order("distributed_at");

  if (error) throw error;

  type LogEntry = { distributed_at: string; distribution_type: string };

  // Group by date and type
  const grouped = ((data || []) as LogEntry[]).reduce((acc, log) => {
    const date = log.distributed_at.split("T")[0];
    if (!date) return acc;
    const key = `${date}-${log.distribution_type}`;

    const existing = acc[key];
    if (!existing) {
      acc[key] = { date, type: log.distribution_type, count: 1 };
    } else {
      existing.count++;
    }

    return acc;
  }, {} as Record<string, DistributionStats>);

  return Object.values(grouped);
}

export async function getTopUsers(limit = 10) {
  const supabase = createClient();
  type CouponData = { customer_id: string; used: boolean };
  const { data: couponsData, error } = await supabase
    .from("coupons")
    .select("customer_id, used");

  if (error) throw error;

  const typedCouponsData = (couponsData || []) as CouponData[];

  if (typedCouponsData.length === 0) {
    return [];
  }

  // Get unique customer IDs
  const customerIds = Array.from(new Set(typedCouponsData.map((c) => c.customer_id)));

  // Fetch profiles separately (exclude test users)
  type ProfileData = { id: string; first_name: string | null; last_name: string | null; email: string | null; is_test: boolean };
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, is_test")
    .in("id", customerIds)
    .eq("is_test", false);

  const profilesMap = new Map(((profilesData || []) as ProfileData[]).map((p) => [p.id, p] as const));

  // Group by user
  const grouped = typedCouponsData.reduce(
    (acc, coupon) => {
      const key = coupon.customer_id;
      const profile = profilesMap.get(key);

      if (!acc[key]) {
        acc[key] = {
          customerId: key,
          name: profile
            ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email || "Inconnu"
            : "Inconnu",
          received: 0,
          used: 0,
        };
      }

      acc[key].received++;
      if (coupon.used) acc[key].used++;

      return acc;
    },
    {} as Record<string, { customerId: string; name: string; received: number; used: number }>
  );

  return Object.values(grouped)
    .sort((a, b) => b.received - a.received)
    .slice(0, limit);
}

export async function getDashboardStats() {
  const supabase = createClient();
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const testIds = await getTestUserIds();
  const excludeTest = (query: any) => {
    if (testIds.length > 0) return query.not("customer_id", "in", `(${testIds.join(",")})`);
    return query;
  };

  // Get counts for different metrics (exclude test users from coupon counts)
  const [
    { count: totalActive },
    { count: usedThisWeek },
    { count: distributedThisMonth },
    { count: pendingPeriods },
  ] = await Promise.all([
    excludeTest(
      supabase
        .from("coupons")
        .select("*", { count: "exact", head: true })
        .eq("used", false)
        .or(`expires_at.is.null,expires_at.gte.${now.toISOString()}`)
    ),
    excludeTest(
      supabase
        .from("coupons")
        .select("*", { count: "exact", head: true })
        .eq("used", true)
    ),
    supabase
      .from("coupon_distribution_logs")
      .select("*", { count: "exact", head: true })
      .gte("distributed_at", startOfMonth.toISOString()),
    supabase
      .from("period_reward_configs")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  return {
    totalActiveCoupons: totalActive || 0,
    couponsUsedThisWeek: usedThisWeek || 0,
    distributionsThisMonth: distributedThisMonth || 0,
    pendingDistributions: pendingPeriods || 0,
  };
}

/**
 * Count receipts (sales) within a date range.
 */
export async function getSalesCount(
  startDate: string,
  endDate: string
): Promise<number> {
  const supabase = createClient();
  const testIds = await getTestUserIds();
  let query = supabase
    .from("receipts")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startDate)
    .lt("created_at", endDate);

  if (testIds.length > 0) query = query.not("customer_id", "in", `(${testIds.join(",")})`) as typeof query;

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

/**
 * Get total sales amount (in centimes) within a date range.
 */
export async function getSalesTotal(
  startDate: string,
  endDate: string
): Promise<number> {
  const supabase = createClient();
  const testIds = await getTestUserIds();
  type ReceiptAmount = { amount: number };
  let query = supabase
    .from("receipts")
    .select("amount")
    .gte("created_at", startDate)
    .lt("created_at", endDate);

  if (testIds.length > 0) query = query.not("customer_id", "in", `(${testIds.join(",")})`) as typeof query;

  const { data, error } = await query;
  if (error) throw error;
  return ((data || []) as ReceiptAmount[]).reduce((sum, r) => sum + (r.amount || 0), 0);
}

/**
 * Get daily cashback credited (gains) and spent (receipt_lines) within a date range.
 * Splits credited into organic (source_type='receipt') and rewards (bonus_cashback_*).
 * Returns an array sorted by date with all values in centimes.
 */
export async function getDailyCashbackStats(
  startDate: string,
  endDate: string
): Promise<DailyCashback[]> {
  const supabase = createClient();

  type GainRow = { created_at: string; cashback_money: number | null; source_type: string | null };
  type SpendingRow = { created_at: string; amount: number };

  const testIds = await getTestUserIds();

  let gainsQuery = supabase
    .from("gains")
    .select("created_at, cashback_money, source_type")
    .gte("created_at", startDate)
    .lt("created_at", endDate)
    .not("cashback_money", "is", null)
    .order("created_at", { ascending: true });

  if (testIds.length > 0) gainsQuery = gainsQuery.not("customer_id", "in", `(${testIds.join(",")})`) as typeof gainsQuery;

  // For spendings (cashback spent), query spendings table instead of receipt_lines
  // to easily filter by customer_id
  let spentQuery = supabase
    .from("spendings")
    .select("created_at, amount")
    .gte("created_at", startDate)
    .lt("created_at", endDate)
    .order("created_at", { ascending: true });

  if (testIds.length > 0) spentQuery = spentQuery.not("customer_id", "in", `(${testIds.join(",")})`) as typeof spentQuery;

  const [gainsRes, spentRes] = await Promise.all([gainsQuery, spentQuery]);

  if (gainsRes.error) throw gainsRes.error;
  if (spentRes.error) throw spentRes.error;

  const organicByDay: Record<string, number> = {};
  const rewardsByDay: Record<string, number> = {};
  for (const row of (gainsRes.data || []) as GainRow[]) {
    const date = row.created_at.split("T")[0];
    if (!date) continue;
    const amount = row.cashback_money || 0;
    if (row.source_type === "receipt") {
      organicByDay[date] = (organicByDay[date] || 0) + amount;
    } else {
      rewardsByDay[date] = (rewardsByDay[date] || 0) + amount;
    }
  }

  const spentByDay: Record<string, number> = {};
  for (const row of (spentRes.data || []) as SpendingRow[]) {
    const date = row.created_at.split("T")[0];
    if (!date) continue;
    spentByDay[date] = (spentByDay[date] || 0) + (row.amount || 0);
  }

  // Fill in all days in range
  const result: DailyCashback[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current < end) {
    const dateStr = current.toISOString().split("T")[0];
    if (!dateStr) {
      current.setDate(current.getDate() + 1);
      continue;
    }
    result.push({
      date: dateStr,
      creditedOrganic: organicByDay[dateStr] || 0,
      creditedRewards: rewardsByDay[dateStr] || 0,
      spent: spentByDay[dateStr] || 0,
    });
    current.setDate(current.getDate() + 1);
  }

  return result;
}

/**
 * Get daily revenue (CA in euros) and PdB spent within a date range.
 * CA = card + cash from receipt_lines. PdB = cashback from receipt_lines.
 * Returns an array sorted by date with all values in centimes.
 */
export async function getDailyRevenueStats(
  startDate: string,
  endDate: string
): Promise<DailyRevenue[]> {
  const supabase = createClient();
  const testIds = await getTestUserIds();

  type ReceiptWithLines = {
    created_at: string;
    receipt_lines: { amount: number; payment_method: string }[];
  };

  let query = supabase
    .from("receipts")
    .select("created_at, receipt_lines(amount, payment_method)")
    .gte("created_at", startDate)
    .lt("created_at", endDate)
    .order("created_at", { ascending: true });

  if (testIds.length > 0) query = query.not("customer_id", "in", `(${testIds.join(",")})`);

  const { data, error } = await query;
  if (error) throw error;

  const cardByDay: Record<string, number> = {};
  const cashByDay: Record<string, number> = {};
  const pdbByDay: Record<string, number> = {};

  for (const receipt of (data || []) as ReceiptWithLines[]) {
    const date = receipt.created_at.split("T")[0];
    if (!date) continue;
    for (const line of receipt.receipt_lines || []) {
      const amount = line.amount || 0;
      if (line.payment_method === "card") {
        cardByDay[date] = (cardByDay[date] || 0) + amount;
      } else if (line.payment_method === "cash") {
        cashByDay[date] = (cashByDay[date] || 0) + amount;
      } else if (line.payment_method === "cashback") {
        pdbByDay[date] = (pdbByDay[date] || 0) + amount;
      }
    }
  }

  const result: DailyRevenue[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current < end) {
    const dateStr = current.toISOString().split("T")[0];
    if (!dateStr) {
      current.setDate(current.getDate() + 1);
      continue;
    }
    result.push({
      date: dateStr,
      card: cardByDay[dateStr] || 0,
      cash: cashByDay[dateStr] || 0,
      pdbSpent: pdbByDay[dateStr] || 0,
    });
    current.setDate(current.getDate() + 1);
  }

  return result;
}

/**
 * Total cashback non dépensé tous users (centimes).
 * Passe par la RPC admin get_unspent_cashback_total (matview user_stats fermée).
 * La RPC exclut elle-même les profils is_test.
 */
export async function getUnspentCashbackTotal(): Promise<number> {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)("get_unspent_cashback_total");
  if (error) throw error;
  return Number(data) || 0;
}

// =============================================================================
// New Analytics RPC Functions
// =============================================================================

export interface AnalyticsFilters {
  startDate: string;
  endDate: string;
  establishmentId?: number;
  employeeId?: string;
}

export interface RevenueData {
  salesCount: number;
  totalEuros: number;
  cardTotal: number;
  cashTotal: number;
  cashbackSpentTotal: number;
}

export interface DebtsData {
  pdbOrganic: number;
  pdbRewards: number;
  pdbBonusCoupons: number;
  pdbTotal: number;
  activePctCouponsCount: number;
  hasFilter: boolean;
}

export interface StockSnapshot {
  organic: number;
  rewards: number;
  bonusCoupons: number;
  totalEarned: number;
  totalSpent: number;
  total: number;
}

export interface StockMovements {
  earnedOrganic: number;
  earnedRewards: number;
  earnedBonusCoupons: number;
  spent: number;
}

export interface StockData {
  opening: StockSnapshot;
  closing: StockSnapshot;
  movements: StockMovements;
  hasFilter: boolean;
}

/**
 * Get revenue breakdown (Euros + PdB spent) for a period with optional filters.
 * All amounts in centimes.
 */
export async function getAnalyticsRevenue(
  filters: AnalyticsFilters
): Promise<RevenueData> {
  const supabase = createClient();
   
  const { data, error } = await (supabase.rpc as any)("get_analytics_revenue", {
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
    p_establishment_id: filters.establishmentId ?? null,
    p_employee_id: filters.employeeId ?? null,
  });

  if (error) throw error;

  return {
    salesCount: Number(data.sales_count) || 0,
    totalEuros: Number(data.total_euros) || 0,
    cardTotal: Number(data.card_total) || 0,
    cashTotal: Number(data.cash_total) || 0,
    cashbackSpentTotal: Number(data.cashback_spent_total) || 0,
  };
}

/**
 * Get PdB debts breakdown by category for a period with optional filters.
 * All amounts in centimes.
 */
export async function getAnalyticsDebts(
  filters: AnalyticsFilters
): Promise<DebtsData> {
  const supabase = createClient();
   
  const { data, error } = await (supabase.rpc as any)("get_analytics_debts", {
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
    p_establishment_id: filters.establishmentId ?? null,
    p_employee_id: filters.employeeId ?? null,
  });

  if (error) throw error;

  return {
    pdbOrganic: Number(data.pdb_organic) || 0,
    pdbRewards: Number(data.pdb_rewards) || 0,
    pdbBonusCoupons: Number(data.pdb_bonus_coupons) || 0,
    pdbTotal: Number(data.pdb_total) || 0,
    activePctCouponsCount: Number(data.active_pct_coupons_count) || 0,
    hasFilter: Boolean(data.has_filter),
  };
}

/**
 * Get PdB stock (opening/closing) by category for a period.
 * All amounts in centimes. Uses proportional allocation for category split.
 */
export async function getAnalyticsStock(
  filters: Pick<AnalyticsFilters, "startDate" | "endDate" | "establishmentId">
): Promise<StockData> {
  const supabase = createClient();
   
  const { data, error } = await (supabase.rpc as any)("get_analytics_stock", {
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
    p_establishment_id: filters.establishmentId ?? null,
  });

  if (error) throw error;

  const mapSnapshot = (s: Record<string, unknown>): StockSnapshot => ({
    organic: Number(s.organic) || 0,
    rewards: Number(s.rewards) || 0,
    bonusCoupons: Number(s.bonus_coupons) || 0,
    totalEarned: Number(s.total_earned) || 0,
    totalSpent: Number(s.total_spent) || 0,
    total: Number(s.total) || 0,
  });

  return {
    opening: mapSnapshot(data.opening),
    closing: mapSnapshot(data.closing),
    movements: {
      earnedOrganic: Number(data.movements.earned_organic) || 0,
      earnedRewards: Number(data.movements.earned_rewards) || 0,
      earnedBonusCoupons: Number(data.movements.earned_bonus_coupons) || 0,
      spent: Number(data.movements.spent) || 0,
    },
    hasFilter: Boolean(data.has_filter),
  };
}

/**
 * Get employees for a given establishment (or all if no filter).
 * Returns employees and establishment managers.
 */
export async function getEmployeesByEstablishment(
  establishmentId?: number
): Promise<{ id: string; name: string }[]> {
  const supabase = createClient();

  let query = supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("role", ["employee", "establishment"]);

  if (establishmentId) {
    query = query.eq("attached_establishment_id", establishmentId);
  }

  const { data, error } = await query;
  if (error) throw error;

  type ProfileRow = { id: string; first_name: string | null; last_name: string | null };
  return ((data || []) as ProfileRow[]).map((p) => ({
    id: p.id,
    name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Sans nom",
  }));
}

/**
 * Get employees with their receipt (ticket) count for a given period.
 */
export async function getEmployeesWithTicketCount(
  establishmentId?: number,
  startDate?: string,
  endDate?: string
): Promise<{ id: string; name: string; ticketCount: number }[]> {
  const supabase = createClient();

  let query = supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("role", ["employee", "establishment"]);

  if (establishmentId) {
    query = query.eq("attached_establishment_id", establishmentId);
  }

  const { data, error } = await query;
  if (error) throw error;

  type ProfileRow = { id: string; first_name: string | null; last_name: string | null };
  const profiles = (data || []) as ProfileRow[];

  if (profiles.length === 0) return [];

  // Fetch receipt counts per employee within the date range
  const employeeIds = profiles.map((p) => p.id);
  let receiptQuery = supabase
    .from("receipts")
    .select("employee_id")
    .in("employee_id", employeeIds);

  if (startDate) receiptQuery = receiptQuery.gte("created_at", startDate);
  if (endDate) receiptQuery = receiptQuery.lt("created_at", endDate);

  const { data: receiptsData, error: receiptsError } = await receiptQuery;
  if (receiptsError) throw receiptsError;

  const countMap: Record<string, number> = {};
  for (const r of (receiptsData || []) as { employee_id: string }[]) {
    countMap[r.employee_id] = (countMap[r.employee_id] || 0) + 1;
  }

  return profiles.map((p) => ({
    id: p.id,
    name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Sans nom",
    ticketCount: countMap[p.id] || 0,
  }));
}

/**
 * Get establishments with their receipt (ticket) count for a given period.
 */
export async function getEstablishmentsWithTicketCount(
  startDate?: string,
  endDate?: string
): Promise<{ id: number; title: string; ticketCount: number }[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("establishments")
    .select("id, title")
    .order("title");

  if (error) throw error;

  type EstRow = { id: number; title: string };
  const establishments = (data || []) as EstRow[];

  if (establishments.length === 0) return [];

  const estIds = establishments.map((e) => e.id);
  let receiptQuery = supabase
    .from("receipts")
    .select("establishment_id")
    .in("establishment_id", estIds);

  if (startDate) receiptQuery = receiptQuery.gte("created_at", startDate);
  if (endDate) receiptQuery = receiptQuery.lt("created_at", endDate);

  const { data: receiptsData, error: receiptsError } = await receiptQuery;
  if (receiptsError) throw receiptsError;

  const countMap: Record<number, number> = {};
  for (const r of (receiptsData || []) as { establishment_id: number }[]) {
    countMap[r.establishment_id] = (countMap[r.establishment_id] || 0) + 1;
  }

  return establishments.map((e) => ({
    id: e.id,
    title: e.title,
    ticketCount: countMap[e.id] || 0,
  }));
}

// =============================================================================
// Drilldown Types & Queries
// =============================================================================

export type DrilldownMetric =
  | "receipts"
  | "spendings"
  | "gainsOrganic"
  | "gainsRewards"
  | "gainsAll"
  | "couponsActive";

export interface DrilldownFilters {
  startDate: string;
  endDate: string;
  establishmentId?: number;
  employeeId?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  count: number;
}

export interface ReceiptConsumptionItemRow {
  id: number;
  consumption_type: string;
  quantity: number;
}

export interface ReceiptDrilldownRow {
  id: number;
  created_at: string;
  customer_id: string;
  customer_name: string;
  establishment_id: number | null;
  establishment_name: string;
  employee_name: string;
  card_total: number;
  cash_total: number;
  cashback_spent: number;
  total: number;
  consumption_items: ReceiptConsumptionItemRow[];
}

export interface SpendingDrilldownRow {
  id: number;
  created_at: string;
  customer_id: string;
  customer_name: string;
  establishment_id: number | null;
  establishment_name: string;
  amount: number;
}

export interface GainDrilldownRow {
  id: number;
  created_at: string;
  customer_id: string;
  customer_name: string;
  establishment_id: number | null;
  establishment_name: string;
  source_type: string;
  period_identifier: string | null;
  xp: number;
  cashback_money: number;
}

export interface CouponDrilldownRow {
  id: number;
  created_at: string;
  customer_id: string;
  customer_name: string;
  percentage: number;
  distribution_type: string;
  period_identifier: string | null;
  expires_at: string | null;
}

/**
 * Fetch paginated receipts for drill-down.
 * Post-processes receipt_lines to compute card/cash/cashback per receipt.
 */
export async function getDrilldownReceipts(
  filters: DrilldownFilters,
  limit = 20,
  offset = 0
): Promise<PaginatedResult<ReceiptDrilldownRow>> {
  const supabase = createClient();

  const testIds = await getTestUserIds();
  let query = supabase
    .from("receipts")
    .select(
      "id, created_at, amount, customer_id, establishment_id, employee_id, profiles!receipts_customer_id_fkey(first_name, last_name), establishments(title), employee:profiles!receipts_employee_id_fkey(first_name, last_name), receipt_lines(amount, payment_method), receipt_consumption_items(id, consumption_type, quantity)",
      { count: "exact" }
    )
    .gte("created_at", filters.startDate)
    .lt("created_at", filters.endDate)
    .order("created_at", { ascending: false });

  if (testIds.length > 0) query = query.not("customer_id", "in", `(${testIds.join(",")})`);
  if (filters.establishmentId) {
    query = query.eq("establishment_id", filters.establishmentId);
  }
  if (filters.employeeId) {
    query = query.eq("employee_id", filters.employeeId);
  }

  const { data, count, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;

  type RawReceipt = {
    id: number;
    created_at: string;
    amount: number;
    customer_id: string;
    establishment_id: number | null;
    profiles: { first_name: string | null; last_name: string | null } | null;
    establishments: { title: string } | null;
    employee: { first_name: string | null; last_name: string | null } | null;
    receipt_lines: { amount: number; payment_method: string }[];
    receipt_consumption_items: { id: number; consumption_type: string; quantity: number }[];
  };

  const rows: ReceiptDrilldownRow[] = ((data || []) as RawReceipt[]).map((r) => {
    let cardTotal = 0;
    let cashTotal = 0;
    let cashbackSpent = 0;
    for (const line of r.receipt_lines || []) {
      if (line.payment_method === "card") cardTotal += line.amount || 0;
      else if (line.payment_method === "cash") cashTotal += line.amount || 0;
      else if (line.payment_method === "cashback") cashbackSpent += line.amount || 0;
    }
    const profileName = r.profiles
      ? `${r.profiles.first_name || ""} ${r.profiles.last_name || ""}`.trim()
      : "";
    const empName = r.employee
      ? `${r.employee.first_name || ""} ${r.employee.last_name || ""}`.trim()
      : "";
    return {
      id: r.id,
      created_at: r.created_at,
      customer_id: r.customer_id,
      customer_name: profileName || "Inconnu",
      establishment_id: r.establishment_id,
      establishment_name: r.establishments?.title || "—",
      employee_name: empName || "—",
      card_total: cardTotal,
      cash_total: cashTotal,
      cashback_spent: cashbackSpent,
      total: r.amount || 0,
      consumption_items: r.receipt_consumption_items || [],
    };
  });

  return { data: rows, count: count || 0 };
}

/**
 * Fetch paginated spendings for drill-down.
 */
export async function getDrilldownSpendings(
  filters: DrilldownFilters,
  limit = 20,
  offset = 0
): Promise<PaginatedResult<SpendingDrilldownRow>> {
  const supabase = createClient();

  const testIds = await getTestUserIds();
  let query = supabase
    .from("spendings")
    .select(
      "id, created_at, amount, customer_id, establishment_id, profiles!spendings_customer_id_fkey(first_name, last_name), establishments(title)",
      { count: "exact" }
    )
    .gte("created_at", filters.startDate)
    .lt("created_at", filters.endDate)
    .order("created_at", { ascending: false });

  if (testIds.length > 0) query = query.not("customer_id", "in", `(${testIds.join(",")})`);
  if (filters.establishmentId) {
    query = query.eq("establishment_id", filters.establishmentId);
  }

  const { data, count, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;

  type RawSpending = {
    id: number;
    created_at: string;
    amount: number;
    customer_id: string;
    establishment_id: number | null;
    profiles: { first_name: string | null; last_name: string | null } | null;
    establishments: { title: string } | null;
  };

  const rows: SpendingDrilldownRow[] = ((data || []) as RawSpending[]).map((r) => {
    const name = r.profiles
      ? `${r.profiles.first_name || ""} ${r.profiles.last_name || ""}`.trim()
      : "";
    return {
      id: r.id,
      created_at: r.created_at,
      customer_id: r.customer_id,
      customer_name: name || "Inconnu",
      establishment_id: r.establishment_id,
      establishment_name: r.establishments?.title || "—",
      amount: r.amount || 0,
    };
  });

  return { data: rows, count: count || 0 };
}

/**
 * Fetch paginated gains for drill-down.
 * sourceTypeFilter: "organic" | "rewards" | "all"
 */
export async function getDrilldownGains(
  filters: DrilldownFilters,
  sourceTypeFilter: "organic" | "rewards" | "all",
  limit = 20,
  offset = 0
): Promise<PaginatedResult<GainDrilldownRow>> {
  const supabase = createClient();

  const testIds = await getTestUserIds();
  let query = supabase
    .from("gains")
    .select(
      "id, created_at, xp, cashback_money, source_type, period_identifier, customer_id, establishment_id, profiles!gains_customer_id_fkey(first_name, last_name), establishments(title)",
      { count: "exact" }
    )
    .gte("created_at", filters.startDate)
    .lt("created_at", filters.endDate)
    .order("created_at", { ascending: false });

  if (testIds.length > 0) query = query.not("customer_id", "in", `(${testIds.join(",")})`);

  if (sourceTypeFilter === "organic") {
    query = query.eq("source_type", "receipt");
  } else if (sourceTypeFilter === "rewards") {
    query = query.in("source_type", [
      "bonus_cashback_quest",
      "bonus_cashback_leaderboard",
    ]);
  }

  // Only filter by establishment for organic gains (rewards have null establishment_id)
  if (filters.establishmentId && sourceTypeFilter === "organic") {
    query = query.eq("establishment_id", filters.establishmentId);
  }

  const { data, count, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;

  type RawGain = {
    id: number;
    created_at: string;
    xp: number | null;
    cashback_money: number | null;
    source_type: string | null;
    period_identifier: string | null;
    customer_id: string;
    establishment_id: number | null;
    profiles: { first_name: string | null; last_name: string | null } | null;
    establishments: { title: string } | null;
  };

  const rows: GainDrilldownRow[] = ((data || []) as RawGain[]).map((r) => {
    const name = r.profiles
      ? `${r.profiles.first_name || ""} ${r.profiles.last_name || ""}`.trim()
      : "";
    return {
      id: r.id,
      created_at: r.created_at,
      customer_id: r.customer_id,
      customer_name: name || "Inconnu",
      establishment_id: r.establishment_id,
      establishment_name: r.establishments?.title || "—",
      source_type: r.source_type || "—",
      period_identifier: r.period_identifier,
      xp: r.xp || 0,
      cashback_money: r.cashback_money || 0,
    };
  });

  return { data: rows, count: count || 0 };
}

/**
 * Fetch paginated active percentage coupons for drill-down.
 */
export async function getDrilldownActiveCoupons(
  filters: DrilldownFilters,
  limit = 20,
  offset = 0
): Promise<PaginatedResult<CouponDrilldownRow>> {
  const supabase = createClient();

  const testIds = await getTestUserIds();
  let query = supabase
    .from("coupons")
    .select(
      "id, created_at, percentage, distribution_type, period_identifier, expires_at, customer_id, profiles!coupons_customer_id_fkey(first_name, last_name)",
      { count: "exact" }
    )
    .eq("used", false)
    .not("percentage", "is", null)
    .gte("created_at", filters.startDate)
    .lt("created_at", filters.endDate)
    .order("created_at", { ascending: false });

  if (testIds.length > 0) query = query.not("customer_id", "in", `(${testIds.join(",")})`);

  const { data, count, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;

  type RawCoupon = {
    id: number;
    created_at: string;
    percentage: number;
    distribution_type: string | null;
    period_identifier: string | null;
    expires_at: string | null;
    customer_id: string;
    profiles: { first_name: string | null; last_name: string | null } | null;
  };

  const rows: CouponDrilldownRow[] = ((data || []) as RawCoupon[]).map((r) => {
    const name = r.profiles
      ? `${r.profiles.first_name || ""} ${r.profiles.last_name || ""}`.trim()
      : "";
    return {
      id: r.id,
      created_at: r.created_at,
      customer_id: r.customer_id,
      customer_name: name || "Inconnu",
      percentage: r.percentage,
      distribution_type: r.distribution_type || "—",
      period_identifier: r.period_identifier,
      expires_at: r.expires_at,
    };
  });

  return { data: rows, count: count || 0 };
}

// =============================================================================
// TIMELINE ANALYTICS — refonte /analytics (tableau par journée fiscale)
// =============================================================================

/**
 * Une ligne de la timeline : métriques d'un établissement sur une journée
 * fiscale (clôture → clôture). Montants en centimes / PdB.
 * `is_fallback_calendar` = true quand aucune clôture Cashpad ne couvrait le
 * receipt (établissement sans Cashpad ou période pas encore backfillée) : le
 * bucket retombe alors sur le jour calendaire Europe/Paris.
 */
export interface TimelineRow {
  establishment_id: number;
  establishment_title: string;
  fiscal_date: string;
  range_begin: string | null;
  range_end: string | null;
  /** Paiements réglés en PdB (centimes). 1 PdB = 1 centime → afficher en €. */
  pdb_payments_cents: number;
  /** Montant total des tickets sur la journée (centimes) → afficher en €. */
  transactions_amount_cents: number;
  /** PdB organiques générés (centimes) → afficher en €. */
  pdb_organic_cents: number;
  is_fallback_calendar: boolean;
}

/**
 * Ligne globale (toutes enseignes) : PdB récompense / total générés par jour
 * calendaire. Les récompenses n'ont pas d'establishment_id rattaché — provisoire
 * en attendant le modèle de dettes inter-établissements.
 */
export interface TimelineGlobalRow {
  fiscal_date: string;
  pdb_reward_cents: number;
  pdb_total_generated_cents: number;
}

/**
 * Métriques par établissement et journée fiscale (paiements PdB, nb
 * transactions, PdB organiques). `establishmentIds` vide ou null = tous.
 */
export async function getAnalyticsTimeline(
  startDate: string,
  endDate: string,
  establishmentIds?: number[]
): Promise<TimelineRow[]> {
  const supabase = createClient();

  const { data, error } = await (supabase.rpc as any)("get_analytics_timeline", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_establishment_ids:
      establishmentIds && establishmentIds.length > 0 ? establishmentIds : null,
  });

  if (error) throw error;
  return (data || []) as TimelineRow[];
}

/**
 * PdB récompense / total générés par jour calendaire (global, toutes enseignes).
 */
export async function getAnalyticsTimelineGlobal(
  startDate: string,
  endDate: string
): Promise<TimelineGlobalRow[]> {
  const supabase = createClient();

  const { data, error } = await (supabase.rpc as any)(
    "get_analytics_timeline_global",
    { p_start_date: startDate, p_end_date: endDate }
  );

  if (error) throw error;
  return (data || []) as TimelineGlobalRow[];
}
