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

export const rewardTierKeys = {
  all: ["rewardTiers"] as const,
  lists: () => [...rewardTierKeys.all, "list"] as const,
  detail: (id: number) => [...rewardTierKeys.all, "detail", id] as const,
};

export const badgeTypeKeys = {
  all: ["badgeTypes"] as const,
  lists: () => [...badgeTypeKeys.all, "list"] as const,
};

export const beerKeys = {
  all: ["beers"] as const,
  lists: () => [...beerKeys.all, "list"] as const,
  detail: (id: number) => [...beerKeys.all, "detail", id] as const,
  establishments: (id: number) =>
    [...beerKeys.all, "establishments", id] as const,
};

export const breweryKeys = {
  all: ["breweries"] as const,
  lists: () => [...breweryKeys.all, "list"] as const,
};

export const establishmentKeys = {
  all: ["establishments"] as const,
  lists: () => [...establishmentKeys.all, "list"] as const,
  detail: (id: number) => [...establishmentKeys.all, "detail", id] as const,
  beers: (id: number) => [...establishmentKeys.all, "beers", id] as const,
  consumptionTypes: (id: number) =>
    [...establishmentKeys.all, "consumptionTypes", id] as const,
};

export const rankKeys = {
  all: ["ranks"] as const,
  lists: () => [...rankKeys.all, "list"] as const,
  detail: (id: number) => [...rankKeys.all, "detail", id] as const,
};

export const adminSettingsKeys = {
  all: ["adminSettings"] as const,
  questAlertRatio: () => [...adminSettingsKeys.all, "questAlertRatio"] as const,
  questReferencePrices: () =>
    [...adminSettingsKeys.all, "questReferencePrices"] as const,
  avgTicket12m: () => [...adminSettingsKeys.all, "avgTicket12m"] as const,
};

export const dashboardKeys = {
  all: ["dashboard"] as const,
  alerts: () => [...dashboardKeys.all, "alerts"] as const,
  activity: () => [...dashboardKeys.all, "activity"] as const,
  gameState: () => [...dashboardKeys.all, "gameState"] as const,
  financialHealth: () => [...dashboardKeys.all, "financialHealth"] as const,
};

export const reconciliationKeys = {
  all: ["reconciliation"] as const,
  list: (filters: Record<string, unknown>) =>
    [...reconciliationKeys.all, "list", filters] as const,
  candidates: (receiptId: number, windowSeconds: number) =>
    [...reconciliationKeys.all, "candidates", receiptId, windowSeconds] as const,
  candidatesByIds: (ids: string[]) =>
    [...reconciliationKeys.all, "candidatesByIds", [...ids].sort()] as const,
};
