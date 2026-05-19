/**
 * Helpers (alias) — types facilitant l'usage dans les services et UI.
 *
 * Ce fichier n'est JAMAIS régénéré par `npm run supabase:types` — le script
 * réécrit uniquement `database.generated.ts`. Les alias ici restent stables
 * et peuvent être enrichis au fil des migrations.
 */

import type { Database } from "./database.generated";

// Enums
export type QuestType = Database["public"]["Enums"]["quest_type"];
export type ConsumptionType = Database["public"]["Enums"]["consumption_type"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type UserRole = Database["public"]["Enums"]["user_role"];
export type PeriodType = "weekly" | "monthly" | "yearly";

// Tables — Row + Insert + Update selon usage
export type Quest = Database["public"]["Tables"]["quests"]["Row"];
export type QuestInsert = Database["public"]["Tables"]["quests"]["Insert"];
export type QuestUpdate = Database["public"]["Tables"]["quests"]["Update"];

export type QuestProgress = Database["public"]["Tables"]["quest_progress"]["Row"];
export type QuestPeriod = Database["public"]["Tables"]["quest_periods"]["Row"];
export type QuestPeriodInsert = Database["public"]["Tables"]["quest_periods"]["Insert"];
export type QuestCompletionLog = Database["public"]["Tables"]["quest_completion_logs"]["Row"];

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type Coupon = Database["public"]["Tables"]["coupons"]["Row"];
export type CouponTemplate = Database["public"]["Tables"]["coupon_templates"]["Row"];
export type CouponTemplateInsert = Database["public"]["Tables"]["coupon_templates"]["Insert"];
export type CouponTemplateUpdate = Database["public"]["Tables"]["coupon_templates"]["Update"];
export type CouponDistributionLog = Database["public"]["Tables"]["coupon_distribution_logs"]["Row"];

export type Receipt = Database["public"]["Tables"]["receipts"]["Row"];
export type ReceiptLine = Database["public"]["Tables"]["receipt_lines"]["Row"];
export type ReceiptConsumptionItem = Database["public"]["Tables"]["receipt_consumption_items"]["Row"];

export type Gain = Database["public"]["Tables"]["gains"]["Row"];
export type BadgeType = Database["public"]["Tables"]["badge_types"]["Row"];

export type RewardTier = Database["public"]["Tables"]["reward_tiers"]["Row"];
export type RewardTierInsert = Database["public"]["Tables"]["reward_tiers"]["Insert"];
export type RewardTierUpdate = Database["public"]["Tables"]["reward_tiers"]["Update"];

export type PeriodRewardConfig = Database["public"]["Tables"]["period_reward_configs"]["Row"];
export type PeriodRewardConfigInsert = Database["public"]["Tables"]["period_reward_configs"]["Insert"];

export type AvailablePeriod = Database["public"]["Tables"]["available_periods"]["Row"];
export type GdprRequest = Database["public"]["Tables"]["gdpr_requests"]["Row"];

// Quest avec relations (pour l'admin)
export type QuestWithRelations = Quest & {
  coupon_templates?: Pick<CouponTemplate, "id" | "name" | "amount" | "percentage"> | null;
  badge_types?: Pick<BadgeType, "id" | "name" | "icon" | "rarity"> | null;
  quest_periods?: QuestPeriod[];
};

// Content tables — Update helpers (utilisés par contentService)
export type BeerUpdate = Database["public"]["Tables"]["beers"]["Update"];
export type EstablishmentUpdate = Database["public"]["Tables"]["establishments"]["Update"];

// Distribution status (utilisé par les pages reward periods)
export type DistributionStatus = "pending" | "distributed" | "cancelled" | "failed";

// Quest <-> Establishment M2M (migration 020)
export type QuestEstablishment = Database["public"]["Tables"]["quests_establishments"]["Row"];
export type QuestEstablishmentInsert = Database["public"]["Tables"]["quests_establishments"]["Insert"];

// Admin settings key-value (migration 020)
export type AdminSetting = Database["public"]["Tables"]["admin_settings"]["Row"];
export type AdminSettingInsert = Database["public"]["Tables"]["admin_settings"]["Insert"];
export type AdminSettingUpdate = Database["public"]["Tables"]["admin_settings"]["Update"];

// Cashpad reconciliation (migration 032).
// Le statut est stocké en TEXT côté BDD (CHECK constraint) et la liste de
// candidats en JSONB — on durcit ici le typage pour l'usage applicatif.
export type ReconciliationStatus =
  | "matched"
  | "orphan_royaume"
  | "ambiguous"
  | "excluded_cashback";

export interface CashpadMatchingParams {
  establishment_id: number;
  clock_offset_seconds: number;
  window_seconds: number;
  sample_size: number;
  computed_at: string;
}

export interface CashpadSnapshotProduct {
  name: string;
  qty: number;
  price_cents: number;
  category: string | null;
}

export interface ReconciliationCandidate {
  cashpad_receipt_id: string;
  time_delta_seconds: number;
  amount_cents: number;
}

type CashpadReceiptSnapshotRow =
  Database["public"]["Tables"]["cashpad_receipts_snapshot"]["Row"];

export type CashpadReceiptSnapshot = Omit<CashpadReceiptSnapshotRow, "products"> & {
  products: CashpadSnapshotProduct[] | null;
};

type CashpadReconciliationRow =
  Database["public"]["Tables"]["cashpad_reconciliations"]["Row"];

export type CashpadReconciliation = Omit<
  CashpadReconciliationRow,
  "status" | "candidates"
> & {
  status: ReconciliationStatus;
  candidates: ReconciliationCandidate[] | null;
};
