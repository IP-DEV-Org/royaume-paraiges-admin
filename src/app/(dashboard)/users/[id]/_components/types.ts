import type { UserWithStats } from "@/lib/services/userService";
import type { UserRole } from "@/types/database";

/** Forme camelCase consommée par les composants du détail utilisateur. */
export interface UserDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  birthdate: string | null;
  username: string | null;
  avatarUrl: string | null;
  identityPhotoUrl: string | null;
  role: UserRole;
  xpCoefficient: number;
  cashbackCoefficient: number;
  attachedEstablishmentId: number | null;
  createdAt: string;
  deletedAt: string | null;
}

/** Compteurs des cartes d'en-tête, dérivés de getUserWithStats. */
export interface UserHeaderStats {
  totalReceipts: number;
  totalSpent: number;
  totalCoupons: number;
  activeCoupons: number;
}

/** Retour de getUserFullStats (XP, solde PdB, rangs leaderboard). */
export interface UserFullStats {
  totalXp: number;
  cashbackBalance: number;
  cashbackEarned: number;
  cashbackSpent: number;
  weeklyRank: number | null;
  monthlyRank: number | null;
  yearlyRank: number | null;
}

export function mapUserDetail(data: UserWithStats): UserDetail {
  return {
    id: data.id,
    firstName: data.first_name || "",
    lastName: data.last_name || "",
    email: data.email || "",
    phone: data.phone,
    birthdate: data.birthdate,
    username: data.username,
    avatarUrl: data.avatar_url,
    identityPhotoUrl: data.identity_photo_url,
    role: data.role,
    xpCoefficient: data.xp_coefficient || 1,
    cashbackCoefficient: data.cashback_coefficient || 1,
    attachedEstablishmentId: data.attached_establishment_id,
    createdAt: data.created_at,
    deletedAt: data.deleted_at || null,
  };
}

export function getUserDisplayName(user: UserDetail): string {
  return user.firstName || user.lastName
    ? `${user.firstName} ${user.lastName}`.trim()
    : user.email || user.id.slice(0, 8) + "...";
}

/** Taille de page commune aux tables paginées du détail utilisateur. */
export const USER_DETAIL_PAGE_SIZE = 10;
