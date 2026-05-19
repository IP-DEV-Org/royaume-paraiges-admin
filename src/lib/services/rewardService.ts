import { createClient } from "@/lib/supabase/client";
import type {
  RewardTier,
  RewardTierInsert,
  RewardTierUpdate,
  PeriodRewardConfig,
  PeriodRewardConfigInsert,
  PeriodType,
  BadgeType,
  Json,
} from "@/types/database";
import { distributeRewardsSchema } from "@/lib/schemas/distributeRewards.schema";

// Badge Types
export async function getBadgeTypes(): Promise<BadgeType[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("badge_types")
    .select("id, slug, name, description, lore, rarity, category, icon")
    .order("category")
    .order("name");
  if (error) throw error;
  return data as BadgeType[];
}

export async function updateBadgeType(id: number, data: { lore?: string | null }): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("badge_types")
    .update(data as never)
    .eq("id", id);
  if (error) throw error;
}

// Reward Tiers
export async function getRewardTiers(periodType?: PeriodType): Promise<RewardTier[]> {
  const supabase = createClient();
  let query = supabase
    .from("reward_tiers")
    .select("*, coupon_templates(name, amount, percentage), badge_types(name)")
    .order("period_type")
    .order("display_order");

  if (periodType) {
    query = query.eq("period_type", periodType);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as RewardTier[];
}

export async function getRewardTier(id: number): Promise<RewardTier | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reward_tiers")
    .select("*, coupon_templates(name, amount, percentage), badge_types(name)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as RewardTier | null;
}

export async function createRewardTier(tier: RewardTierInsert) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reward_tiers")
    .insert(tier as never)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateRewardTier(id: number, tier: RewardTierUpdate) {
  const supabase = createClient();
  const payload: RewardTierUpdate = { ...tier, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("reward_tiers")
    .update(payload as never)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteRewardTier(id: number) {
  const supabase = createClient();
  const { error } = await supabase.from("reward_tiers").delete().eq("id", id);

  if (error) throw error;
}

// Period Reward Configs
export async function getPeriodConfigs(periodType?: PeriodType): Promise<PeriodRewardConfig[]> {
  const supabase = createClient();
  let query = supabase
    .from("period_reward_configs")
    .select("*")
    .order("period_identifier", { ascending: false });

  if (periodType) {
    query = query.eq("period_type", periodType);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as PeriodRewardConfig[];
}

export async function getPeriodConfig(
  periodType: PeriodType,
  periodIdentifier: string
): Promise<PeriodRewardConfig | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("period_reward_configs")
    .select("*")
    .eq("period_type", periodType)
    .eq("period_identifier", periodIdentifier)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as PeriodRewardConfig | null;
}

export async function createPeriodConfig(config: PeriodRewardConfigInsert) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("period_reward_configs")
    .insert(config as never)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePeriodConfig(
  id: number,
  config: Partial<PeriodRewardConfig>
) {
  const supabase = createClient();
  const payload = { ...config, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("period_reward_configs")
    .update(payload as never)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Distribution functions
export async function getDistributionPreview(
  periodType: PeriodType,
  periodIdentifier?: string
) {
  const supabase = createClient();
   
  const { data, error } = await (supabase.rpc as any)("get_period_preview", {
    p_period_type: periodType,
    p_period_identifier: periodIdentifier,
  });

  if (error) throw error;
  return data;
}

export async function distributeRewards(
  periodType: PeriodType,
  periodIdentifier?: string
) {
  const input = distributeRewardsSchema.parse({
    periodType,
    periodIdentifier,
    force: false,
    previewOnly: false,
  });
  const supabase = createClient();

  const { data, error } = await (supabase.rpc as any)("distribute_period_rewards_v2", {
    p_period_type: input.periodType,
    p_period_identifier: input.periodIdentifier,
    p_force: input.force,
    p_preview_only: input.previewOnly,
  });

  if (error) throw error;
  return data;
}

export async function forceDistributeRewards(
  periodType: PeriodType,
  periodIdentifier?: string
) {
  const input = distributeRewardsSchema.parse({
    periodType,
    periodIdentifier,
    force: true,
    previewOnly: false,
  });
  const supabase = createClient();

  const { data, error } = await (supabase.rpc as any)("distribute_period_rewards_v2", {
    p_period_type: input.periodType,
    p_period_identifier: input.periodIdentifier,
    p_force: input.force,
    p_preview_only: input.previewOnly,
  });

  if (error) throw error;
  return data;
}

export async function createOrUpdatePeriodConfig(
  periodType: PeriodType,
  periodIdentifier: string,
  customTiers: Json | null,
  notes?: string
): Promise<PeriodRewardConfig> {
  // Check if config already exists
  const existing = await getPeriodConfig(periodType, periodIdentifier);

  if (existing) {
    return updatePeriodConfig(existing.id, {
      custom_tiers: customTiers,
      notes: notes || existing.notes,
    });
  } else {
    return createPeriodConfig({
      period_type: periodType,
      period_identifier: periodIdentifier,
      custom_tiers: customTiers,
      notes: notes || null,
    });
  }
}
