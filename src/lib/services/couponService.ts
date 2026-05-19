import { createClient } from "@/lib/supabase/client";
import type { Coupon, CouponDistributionLog, Gain, Profile } from "@/types/database";
import { manualCouponSchema } from "@/lib/schemas/manualCoupon.schema";

export interface CouponFilters {
  isUsed?: boolean;
  distributionType?: string;
  customerId?: string;
  isExpired?: boolean;
  couponType?: "amount" | "percentage";
}

export async function getCoupons(filters?: CouponFilters, limit = 50, offset = 0) {
  const supabase = createClient();

  const baseQuery = supabase
    .from("coupons")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

   
  let query: any = baseQuery;

  if (filters?.isUsed !== undefined) {
    query = query.eq("used", filters.isUsed);
  }
  if (filters?.distributionType) {
    query = query.eq("distribution_type", filters.distributionType);
  }
  if (filters?.customerId) {
    query = query.eq("customer_id", filters.customerId);
  }
  if (filters?.isExpired === true) {
    query = query.lt("expires_at", new Date().toISOString());
  } else if (filters?.isExpired === false) {
    query = query.or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`);
  }
  if (filters?.couponType === "amount") {
    query = query.not("amount", "is", null).is("percentage", null);
  } else if (filters?.couponType === "percentage") {
    query = query.not("percentage", "is", null).is("amount", null);
  }

  const { data: coupons, error, count } = await query;

  if (error) throw error;

  const couponsData = coupons as Coupon[] | null;

  if (!couponsData || couponsData.length === 0) {
    return { data: [], count };
  }

  // Fetch related data separately
  const customerIds = Array.from(new Set(couponsData.map((c) => c.customer_id)));
  const templateIds = Array.from(
    new Set(couponsData.map((c) => c.template_id).filter((id): id is number => id !== null))
  );

  type ProfileData = { id: string; first_name: string | null; last_name: string | null; email: string | null };
  type TemplateData = { id: number; name: string };

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .in("id", customerIds);

  let templatesData: TemplateData[] = [];
  if (templateIds.length > 0) {
    const res = await supabase.from("coupon_templates").select("id, name").in("id", templateIds);
    templatesData = (res.data || []) as TemplateData[];
  }

  const profilesMap = new Map(((profilesData || []) as ProfileData[]).map((p) => [p.id, p] as const));
  const templatesMap = new Map(templatesData.map((t) => [t.id, t] as const));

  const data = couponsData.map((coupon) => ({
    ...coupon,
    profiles: profilesMap.get(coupon.customer_id) || null,
    coupon_templates: coupon.template_id ? templatesMap.get(coupon.template_id) || null : null,
  }));

  return { data, count };
}

export async function getCoupon(id: number) {
  const supabase = createClient();
  const { data, error } = await supabase.from("coupons").select("*").eq("id", id).single();

  if (error) throw error;
  if (!data) return null;

  const coupon = data as Coupon;

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", coupon.customer_id)
    .single();

  let template = null;
  if (coupon.template_id) {
    const { data: tplData } = await supabase
      .from("coupon_templates")
      .select("name, description")
      .eq("id", coupon.template_id)
      .single();
    template = tplData;
  }

  return {
    ...coupon,
    profiles: profile,
    coupon_templates: template,
  };
}

export async function createManualCoupon(params: {
  customerId: string;
  templateId?: number;
  amount?: number;
  percentage?: number;
  expiresAt?: string;
  notes?: string;
}) {
  const input = manualCouponSchema.parse(params);
  const supabase = createClient();

  // Convert date string (YYYY-MM-DD) to ISO timestamp for PostgreSQL
  const expiresAtTimestamp = input.expiresAt
    ? new Date(input.expiresAt + "T23:59:59.999Z").toISOString()
    : null;


  const { data, error } = await (supabase.rpc as any)("create_manual_coupon", {
    p_customer_id: input.customerId,
    p_template_id: input.templateId ?? null,
    p_amount: input.amount ?? null,
    p_percentage: input.percentage ?? null,
    p_expires_at: expiresAtTimestamp,
    p_notes: input.notes ?? null,
  });

  if (error) throw error;
  return data;
}

export async function getDistributionLogs(
  limit = 50,
  offset = 0,
  filters?: {
    distributionType?: string;
    periodIdentifier?: string;
    customerId?: string;
  }
) {
  const supabase = createClient();

  const baseQuery = supabase
    .from("coupon_distribution_logs")
    .select("*", { count: "exact" })
    .order("distributed_at", { ascending: false })
    .range(offset, offset + limit - 1);

   
  let query: any = baseQuery;

  if (filters?.distributionType) {
    query = query.eq("distribution_type", filters.distributionType);
  }
  if (filters?.periodIdentifier) {
    query = query.eq("period_identifier", filters.periodIdentifier);
  }
  if (filters?.customerId) {
    query = query.eq("customer_id", filters.customerId);
  }

  const { data: logs, error, count } = await query;

  if (error) throw error;

  const logsData = logs as CouponDistributionLog[] | null;

  if (!logsData || logsData.length === 0) {
    return { data: [], count };
  }

  const customerIds = Array.from(new Set(logsData.map((l) => l.customer_id)));
  const templateIds = Array.from(
    new Set(logsData.map((l) => l.coupon_template_id).filter((id): id is number => id !== null))
  );
  const tierIds = Array.from(
    new Set(logsData.map((l) => l.tier_id).filter((id): id is number => id !== null))
  );

  type ProfileData = { id: string; first_name: string | null; last_name: string | null; email: string | null };
  type TemplateData = { id: number; name: string };
  type TierData = { id: number; name: string };

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .in("id", customerIds);

  let templatesData: TemplateData[] = [];
  if (templateIds.length > 0) {
    const res = await supabase.from("coupon_templates").select("id, name").in("id", templateIds);
    templatesData = (res.data || []) as TemplateData[];
  }

  let tiersData: TierData[] = [];
  if (tierIds.length > 0) {
    const res = await supabase.from("reward_tiers").select("id, name").in("id", tierIds);
    tiersData = (res.data || []) as TierData[];
  }

  const profilesMap = new Map(((profilesData || []) as ProfileData[]).map((p) => [p.id, p] as const));
  const templatesMap = new Map(templatesData.map((t) => [t.id, t] as const));
  const tiersMap = new Map(tiersData.map((t) => [t.id, t] as const));

  const data = logsData.map((log) => ({
    ...log,
    profiles: profilesMap.get(log.customer_id) || null,
    coupon_templates: log.coupon_template_id ? templatesMap.get(log.coupon_template_id) || null : null,
    reward_tiers: log.tier_id ? tiersMap.get(log.tier_id) || null : null,
  }));

  return { data, count };
}

export type GainWithProfile = Gain & {
  profiles: { first_name: string | null; last_name: string | null; email: string | null } | null;
};

export async function getBonusCashbackGains(limit = 100, offset = 0) {
  const supabase = createClient();

  const { data: gains, error, count } = await supabase
    .from("gains")
    .select("*", { count: "exact" })
    .like("source_type", "bonus_cashback_%")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const gainsData = gains as Gain[] | null;

  if (!gainsData || gainsData.length === 0) {
    return { data: [] as GainWithProfile[], count };
  }

  const customerIds = Array.from(new Set(gainsData.map((g) => g.customer_id)));

  type ProfileData = { id: string; first_name: string | null; last_name: string | null; email: string | null };

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .in("id", customerIds);

  const profilesMap = new Map(((profilesData || []) as ProfileData[]).map((p) => [p.id, p] as const));

  const data: GainWithProfile[] = gainsData.map((gain) => ({
    ...gain,
    profiles: profilesMap.get(gain.customer_id) || null,
  }));

  return { data, count };
}

export async function searchCustomers(search: string): Promise<Profile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
    .limit(10);

  if (error) throw error;
  return (data || []) as Profile[];
}
