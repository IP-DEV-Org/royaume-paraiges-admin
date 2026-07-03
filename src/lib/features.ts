// Registre des fonctionnalités désactivables par le super admin (migration 057).
// Module volontairement sans dépendance UI (pas d'icônes lucide) : il est importé
// par le middleware Edge en plus du client. La navigation (src/lib/navigation.ts)
// attache ces clés aux entrées de la sidebar.
//
// Règle : une nouvelle page de la sidebar = une nouvelle clé ici + son href racine
// dans FEATURE_ROUTES + le featureKey sur le NavItem correspondant.

export const FEATURE_KEYS = [
  "analytics",
  "analytics-xp",
  "reconciliation",
  "users",
  "receipts",
  "coupons",
  "cashback-gains",
  "history",
  "quests",
  "rewards",
  "achievements",
  "storytelling",
  "templates",
  "beers",
  "establishments",
  "gdpr",
  "documentation",
  "settings",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

// Href racine de chaque fonctionnalité ; les sous-routes héritent par préfixe
// (ex. /quests/create → quests, /rewards/tiers → rewards).
export const FEATURE_ROUTES: Record<FeatureKey, string> = {
  analytics: "/analytics",
  "analytics-xp": "/analytics/xp",
  reconciliation: "/reconciliation",
  users: "/users",
  receipts: "/receipts",
  coupons: "/coupons",
  "cashback-gains": "/rewards/cashback-gains",
  history: "/history",
  quests: "/quests",
  rewards: "/rewards",
  achievements: "/rewards/achievements",
  storytelling: "/content/storytelling",
  templates: "/templates",
  beers: "/content/beers",
  establishments: "/content/establishments",
  gdpr: "/gdpr",
  documentation: "/documentation",
  settings: "/settings",
};

// Résout un pathname vers sa fonctionnalité par longest-prefix match :
// /rewards/achievements/3 → achievements (et pas rewards).
// "/" (dashboard, cible du redirect de blocage) et /login → null = jamais bloqués.
export function resolveFeatureKey(pathname: string): FeatureKey | null {
  let best: FeatureKey | null = null;
  let bestLen = 0;
  for (const key of FEATURE_KEYS) {
    const href = FEATURE_ROUTES[key];
    if (
      (pathname === href || pathname.startsWith(href + "/")) &&
      href.length > bestLen
    ) {
      best = key;
      bestLen = href.length;
    }
  }
  return best;
}
