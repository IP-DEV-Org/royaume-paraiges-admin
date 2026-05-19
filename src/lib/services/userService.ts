import { createClient } from "@/lib/supabase/client";
import { Profile, ProfileUpdate, UserRole, Coupon, Receipt, ReceiptLine, ReceiptConsumptionItem } from "@/types/database";

export interface UserFilters {
  role?: UserRole;
  search?: string;
  includeDeleted?: boolean;
  includeTest?: boolean;
}

export interface UserWithStats extends Profile {
  totalReceipts?: number;
  totalSpent?: number;
  totalCoupons?: number;
  activeCoupons?: number;
}

export interface UserCoupon extends Coupon {
  coupon_templates: { name: string } | null;
}

export interface UserReceipt extends Receipt {
  receipt_lines?: ReceiptLine[];
  receipt_consumption_items?: ReceiptConsumptionItem[];
  establishment?: { id: number; title: string } | null;
}

export async function getUsers(
  filters?: UserFilters,
  limit = 20,
  offset = 0
): Promise<{ data: Profile[]; count: number }> {
  const supabase = createClient();

  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (!filters?.includeDeleted) {
    query = query.is("deleted_at", null);
  }

  if (!filters?.includeTest) {
    query = query.eq("is_test", false);
  }

  if (filters?.role) {
    query = query.eq("role", filters.role);
  }

  if (filters?.search) {
    query = query.or(
      `email.ilike.%${filters.search}%,first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`
    );
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching users:", error);
    throw error;
  }

  return { data: data || [], count: count || 0 };
}

export async function getUser(userId: string): Promise<Profile | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching user:", error);
    return null;
  }

  return data;
}

export async function getUserWithStats(userId: string): Promise<UserWithStats | null> {
  const supabase = createClient();

  type ReceiptAmount = { amount: number };
  type CouponUsed = { used: boolean };

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError || !profileData) {
    console.error("Error fetching user:", profileError);
    return null;
  }

  const profile = profileData as Profile;

  const [receiptsResult, couponsResult] = await Promise.all([
    supabase.from("receipts").select("amount").eq("customer_id", userId),
    supabase.from("coupons").select("used").eq("customer_id", userId),
  ]);

  const receipts = (receiptsResult.data || []) as ReceiptAmount[];
  const coupons = (couponsResult.data || []) as CouponUsed[];

  const totalReceipts = receipts.length;
  const totalSpent = receipts.reduce((sum, r) => sum + r.amount, 0);
  const totalCoupons = coupons.length;
  const activeCoupons = coupons.filter((c) => !c.used).length;

  return {
    ...profile,
    totalReceipts,
    totalSpent,
    totalCoupons,
    activeCoupons,
  };
}

export async function getUserStats(): Promise<{
  totalUsers: number;
  totalClients: number;
  totalEmployees: number;
  totalEstablishments: number;
  totalAdmins: number;
  newUsersThisMonth: number;
}> {
  const supabase = createClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [allUsersResult, clientsResult, employeesResult, establishmentsResult, adminsResult, newUsersResult] =
    await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_test", false).is("deleted_at", null),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "client")
        .eq("is_test", false)
        .is("deleted_at", null),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "employee")
        .eq("is_test", false)
        .is("deleted_at", null),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "establishment")
        .eq("is_test", false)
        .is("deleted_at", null),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("is_test", false)
        .is("deleted_at", null),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_test", false)
        .is("deleted_at", null)
        .gte("created_at", startOfMonth.toISOString()),
    ]);

  return {
    totalUsers: allUsersResult.count || 0,
    totalClients: clientsResult.count || 0,
    totalEmployees: employeesResult.count || 0,
    totalEstablishments: establishmentsResult.count || 0,
    totalAdmins: adminsResult.count || 0,
    newUsersThisMonth: newUsersResult.count || 0,
  };
}

export async function updateUser(
  userId: string,
  data: ProfileUpdate
): Promise<Profile> {
  const supabase = createClient();
  const payload: ProfileUpdate = { ...data, updated_at: new Date().toISOString() };

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(payload as never)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating user:", error);
    throw error;
  }

  return updated as Profile;
}

export async function getUserCoupons(
  userId: string,
  limit = 20,
  offset = 0
): Promise<{ data: UserCoupon[]; count: number }> {
  const supabase = createClient();

  const { data: coupons, error, count } = await supabase
    .from("coupons")
    .select("*", { count: "exact" })
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching user coupons:", error);
    throw error;
  }

  const couponsData = (coupons || []) as Coupon[];

  if (couponsData.length === 0) {
    return { data: [], count: count || 0 };
  }

  const templateIds = Array.from(
    new Set(couponsData.map((c) => c.template_id).filter((id): id is number => id !== null))
  );

  type TemplateData = { id: number; name: string };
  let templatesData: TemplateData[] = [];
  if (templateIds.length > 0) {
    const res = await supabase.from("coupon_templates").select("id, name").in("id", templateIds);
    templatesData = (res.data || []) as TemplateData[];
  }

  const templatesMap = new Map(templatesData.map((t) => [t.id, t] as const));

  const data = couponsData.map((coupon) => ({
    ...coupon,
    coupon_templates: coupon.template_id ? templatesMap.get(coupon.template_id) || null : null,
  }));

  return { data, count: count || 0 };
}

export async function getUserReceipts(
  userId: string,
  limit = 20,
  offset = 0
): Promise<{ data: UserReceipt[]; count: number }> {
  const supabase = createClient();

  const { data: receipts, error, count } = await supabase
    .from("receipts")
    .select(
      `
      *,
      receipt_lines(id, amount, payment_method),
      receipt_consumption_items(id, consumption_type, quantity),
      establishment:establishments!establishment_id(id, title)
    `,
      { count: "exact" }
    )
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching user receipts:", error);
    throw error;
  }

  return { data: (receipts || []) as UserReceipt[], count: count || 0 };
}

export interface UserActivityStats {
  ordersCount: number;
  totalSpentEuros: number;
  xpEarned: number;
  cashbackEarned: number;
  cashbackEarnedOrganic: number;
  cashbackEarnedRewards: number;
  cashbackSpent: number;
}

export async function getUserActivityStats(
  userId: string,
  startDate: string,
  endDate: string
): Promise<UserActivityStats> {
  const supabase = createClient();

  type ReceiptRow = { amount: number };
  type GainRow = { xp: number | null; cashback_money: number | null; source_type: string | null };
  type SpendingRow = { amount: number };

  const [receiptsRes, gainsRes, spendingsRes] = await Promise.all([
    supabase
      .from("receipts")
      .select("amount")
      .eq("customer_id", userId)
      .gte("created_at", startDate)
      .lt("created_at", endDate),
    supabase
      .from("gains")
      .select("xp, cashback_money, source_type")
      .eq("customer_id", userId)
      .gte("created_at", startDate)
      .lt("created_at", endDate),
    supabase
      .from("spendings")
      .select("amount")
      .eq("customer_id", userId)
      .gte("created_at", startDate)
      .lt("created_at", endDate),
  ]);

  if (receiptsRes.error) throw receiptsRes.error;
  if (gainsRes.error) throw gainsRes.error;
  if (spendingsRes.error) throw spendingsRes.error;

  const receipts = (receiptsRes.data || []) as ReceiptRow[];
  const gains = (gainsRes.data || []) as GainRow[];
  const spendings = (spendingsRes.data || []) as SpendingRow[];

  let xpEarned = 0;
  let cashbackOrganic = 0;
  let cashbackRewards = 0;
  for (const g of gains) {
    xpEarned += g.xp || 0;
    const cb = g.cashback_money || 0;
    if (g.source_type === "receipt") {
      cashbackOrganic += cb;
    } else {
      cashbackRewards += cb;
    }
  }

  return {
    ordersCount: receipts.length,
    totalSpentEuros: receipts.reduce((sum, r) => sum + (r.amount || 0), 0),
    xpEarned,
    cashbackEarned: cashbackOrganic + cashbackRewards,
    cashbackEarnedOrganic: cashbackOrganic,
    cashbackEarnedRewards: cashbackRewards,
    cashbackSpent: spendings.reduce((sum, s) => sum + (s.amount || 0), 0),
  };
}

export interface UserDailyCashback {
  date: string;
  earnedOrganic: number;
  earnedRewards: number;
  spent: number;
}

export async function getUserDailyCashback(
  userId: string,
  startDate: string,
  endDate: string
): Promise<UserDailyCashback[]> {
  const supabase = createClient();

  type GainRow = { created_at: string; cashback_money: number | null; source_type: string | null };
  type SpendingRow = { created_at: string; amount: number };

  const [gainsRes, spendingsRes] = await Promise.all([
    supabase
      .from("gains")
      .select("created_at, cashback_money, source_type")
      .eq("customer_id", userId)
      .gte("created_at", startDate)
      .lt("created_at", endDate)
      .not("cashback_money", "is", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("spendings")
      .select("created_at, amount")
      .eq("customer_id", userId)
      .gte("created_at", startDate)
      .lt("created_at", endDate)
      .order("created_at", { ascending: true }),
  ]);

  if (gainsRes.error) throw gainsRes.error;
  if (spendingsRes.error) throw spendingsRes.error;

  const organicByDay: Record<string, number> = {};
  const rewardsByDay: Record<string, number> = {};
  for (const row of (gainsRes.data || []) as GainRow[]) {
    const date = row.created_at.split("T")[0];
    if (!date) continue;
    const cb = row.cashback_money || 0;
    if (row.source_type === "receipt") {
      organicByDay[date] = (organicByDay[date] || 0) + cb;
    } else {
      rewardsByDay[date] = (rewardsByDay[date] || 0) + cb;
    }
  }

  const spentByDay: Record<string, number> = {};
  for (const row of (spendingsRes.data || []) as SpendingRow[]) {
    const date = row.created_at.split("T")[0];
    if (!date) continue;
    spentByDay[date] = (spentByDay[date] || 0) + (row.amount || 0);
  }

  const result: UserDailyCashback[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current < end) {
    const dateStr = current.toISOString().split("T")[0];
    if (!dateStr) {
      current.setDate(current.getDate() + 1);
      continue;
    }
    const earnedOrganic = organicByDay[dateStr] || 0;
    const earnedRewards = rewardsByDay[dateStr] || 0;
    const spent = spentByDay[dateStr] || 0;
    if (earnedOrganic > 0 || earnedRewards > 0 || spent > 0) {
      result.push({ date: dateStr, earnedOrganic, earnedRewards, spent });
    }
    current.setDate(current.getDate() + 1);
  }

  return result;
}

export interface UserGain {
  id: number;
  created_at: string;
  xp: number | null;
  cashback_money: number | null;
  source_type: string | null;
  period_identifier: string | null;
  receipt_id: number | null;
  establishment_id: number | null;
  coupon_id: number | null;
  establishment?: { id: number; title: string } | null;
}

export async function getUserGains(
  userId: string,
  limit: number,
  offset: number,
  sourceFilter?: string
): Promise<{ data: UserGain[]; count: number }> {
  const supabase = createClient();

  let query = supabase
    .from("gains")
    .select(
      `
      id, created_at, xp, cashback_money, source_type, period_identifier,
      receipt_id, establishment_id, coupon_id,
      establishment:establishments!establishment_id(id, title)
    `,
      { count: "exact" }
    )
    .eq("customer_id", userId)
    .order("created_at", { ascending: false });

  if (sourceFilter && sourceFilter !== "all") {
    query = query.eq("source_type", sourceFilter);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching user gains:", error);
    throw error;
  }

  return { data: (data || []) as UserGain[], count: count || 0 };
}

export interface UserQuestProgress {
  id: number;
  quest_id: number;
  customer_id: string;
  period_identifier: string;
  current_value: number;
  target_value: number;
  status: string;
  completed_at: string | null;
  updated_at: string;
  created_at: string;
  quest: { id: number; name: string; quest_type: string } | null;
}

export async function getUserQuestProgress(
  userId: string,
  limit: number,
  offset: number,
  periodTypeFilter?: string,
  statusFilter?: string
): Promise<{ data: UserQuestProgress[]; count: number }> {
  const supabase = createClient();

  let query = supabase
    .from("quest_progress")
    .select(
      `
      id, quest_id, customer_id, period_identifier,
      current_value, target_value, status,
      completed_at, updated_at, created_at,
      quest:quests!quest_id(id, name, quest_type)
    `,
      { count: "exact" }
    )
    .eq("customer_id", userId)
    .order("updated_at", { ascending: false });

  if (periodTypeFilter && periodTypeFilter !== "all") {
    query = query.eq("period_type", periodTypeFilter);
  }

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching user quest progress:", error);
    throw error;
  }

  return { data: (data || []) as UserQuestProgress[], count: count || 0 };
}

export async function getUserFullStats(userId: string): Promise<{
  totalXp: number;
  cashbackBalance: number;
  cashbackEarned: number;
  cashbackSpent: number;
  weeklyRank: number | null;
  monthlyRank: number | null;
  yearlyRank: number | null;
} | null> {
  const supabase = createClient();

  // user_stats and leaderboard columns are bigint (from SUM/row_number),
  // PostgREST returns bigints as strings — must convert with Number()
  type UserStatsRow = {
    customer_id: string;
    total_xp: number | string;
    cashback_available: number | string;
    cashback_earned: number | string;
    cashback_spent: number | string;
  };

  type RankRow = { rank: number | string; total_xp: number | string };

  const [statsResult, weeklyResult, monthlyResult, yearlyResult] = await Promise.all([
    // RPCs sécurisées (matviews fermées). get_user_stats vérifie le rôle admin/employee.
    (supabase.rpc as any)("get_user_stats", { p_customer_id: userId }),
    (supabase.rpc as any)("get_current_xp_rank", { p_period_type: "weekly", p_customer_id: userId }),
    (supabase.rpc as any)("get_current_xp_rank", { p_period_type: "monthly", p_customer_id: userId }),
    (supabase.rpc as any)("get_current_xp_rank", { p_period_type: "yearly", p_customer_id: userId }),
  ]);

  const statsRows = Array.isArray(statsResult.data) ? (statsResult.data as UserStatsRow[]) : [];
  const userStats: UserStatsRow | null = statsRows[0] ?? null;
  const weeklyRank = (weeklyResult.data as RankRow[] | null)?.[0]?.rank;
  const monthlyRank = (monthlyResult.data as RankRow[] | null)?.[0]?.rank;
  const yearlyRank = (yearlyResult.data as RankRow[] | null)?.[0]?.rank;

  return {
    totalXp: Number(userStats?.total_xp) || 0,
    cashbackBalance: Number(userStats?.cashback_available) || 0,
    cashbackEarned: Number(userStats?.cashback_earned) || 0,
    cashbackSpent: Number(userStats?.cashback_spent) || 0,
    weeklyRank: weeklyRank != null ? Number(weeklyRank) : null,
    monthlyRank: monthlyRank != null ? Number(monthlyRank) : null,
    yearlyRank: yearlyRank != null ? Number(yearlyRank) : null,
  };
}
