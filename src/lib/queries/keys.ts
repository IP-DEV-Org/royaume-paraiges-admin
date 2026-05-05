/**
 * Query key factories for TanStack React Query.
 *
 * Convention : chaque domaine expose un objet `xxxKeys` avec :
 * - `all` : racine pour invalidation large
 * - `lists()` / `list(filters)` : pour les listings
 * - `detail(id)` : pour les ressources individuelles
 *
 * Pour invalider toutes les queries d'un domaine après mutation :
 * `queryClient.invalidateQueries({ queryKey: xxxKeys.all })`
 */

export const achievementBadgeKeys = {
  all: ["achievementBadges"] as const,
  lists: () => [...achievementBadgeKeys.all, "list"] as const,
  detail: (id: number) => [...achievementBadgeKeys.all, "detail", id] as const,
};

export const couponKeys = {
  all: ["coupons"] as const,
  lists: () => [...couponKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...couponKeys.lists(), filters] as const,
};

export const templateKeys = {
  all: ["templates"] as const,
  lists: () => [...templateKeys.all, "list"] as const,
  active: () => [...templateKeys.all, "active"] as const,
  detail: (id: number) => [...templateKeys.all, "detail", id] as const,
};

export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...userKeys.lists(), filters] as const,
  detail: (id: string) => [...userKeys.all, "detail", id] as const,
};

export const questKeys = {
  all: ["quests"] as const,
  lists: () => [...questKeys.all, "list"] as const,
  detail: (id: number) => [...questKeys.all, "detail", id] as const,
  establishments: (id: number) =>
    [...questKeys.all, "establishments", id] as const,
};
