import {
  LayoutDashboard,
  Ticket,
  FileText,
  Trophy,
  History,
  BarChart3,
  Users,
  Receipt,
  Beer,
  Building2,
  BookOpen,
  BookText,
  Target,
  Shield,
  Scale,
  Coins,
  Award,
  Settings as SettingsIcon,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

// Source unique de vérité pour la navigation : consommée par la Sidebar,
// le fil d'Ariane (Breadcrumbs) et la palette de commandes (Cmd+K).
export const navigationGroups: NavGroup[] = [
  {
    title: "Vue d'ensemble",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      { name: "Analytics", href: "/analytics", icon: BarChart3 },
      { name: "Répartition XP", href: "/analytics/xp", icon: Zap },
      { name: "Réconciliation Cashpad", href: "/reconciliation", icon: Scale },
    ],
  },
  {
    title: "Activité",
    items: [
      { name: "Utilisateurs", href: "/users", icon: Users },
      { name: "Tickets de caisse", href: "/receipts", icon: Receipt },
      { name: "Coupons", href: "/coupons", icon: Ticket },
      { name: "Bonus cashback", href: "/rewards/cashback-gains", icon: Coins },
      { name: "Historique de distribution", href: "/history", icon: History },
    ],
  },
  {
    title: "Gamification",
    items: [
      { name: "Quêtes", href: "/quests", icon: Target },
      { name: "Paliers & saison", href: "/rewards", icon: Trophy },
      { name: "Badges", href: "/rewards/achievements", icon: Award },
      { name: "Niveaux & lore", href: "/content/storytelling", icon: BookOpen },
      { name: "Modèles de coupons", href: "/templates", icon: FileText },
    ],
  },
  {
    title: "Contenu",
    items: [
      { name: "Bières", href: "/content/beers", icon: Beer },
      { name: "Établissements", href: "/content/establishments", icon: Building2 },
    ],
  },
  {
    title: "Système",
    items: [
      { name: "RGPD", href: "/gdpr", icon: Shield },
      { name: "Documentation", href: "/documentation", icon: BookText },
      { name: "Paramètres", href: "/settings", icon: SettingsIcon },
    ],
  },
];

// Libellés des segments d'URL non couverts par la navigation principale,
// utilisés pour construire le fil d'Ariane.
export const segmentLabels: Record<string, string> = {
  analytics: "Analytics",
  xp: "Répartition XP",
  reconciliation: "Réconciliation Cashpad",
  health: "Santé",
  users: "Utilisateurs",
  receipts: "Tickets de caisse",
  coupons: "Coupons",
  history: "Historique de distribution",
  quests: "Quêtes",
  rewards: "Récompenses",
  periods: "Périodes",
  tiers: "Paliers",
  achievements: "Badges",
  "cashback-gains": "Bonus cashback",
  distribute: "Distribution",
  season: "Clôture de saison",
  content: "Contenu",
  beers: "Bières",
  establishments: "Établissements",
  storytelling: "Niveaux & lore",
  templates: "Modèles de coupons",
  gdpr: "RGPD",
  documentation: "Documentation",
  settings: "Paramètres",
  create: "Créer",
  weekly: "Hebdomadaire",
  monthly: "Mensuelle",
  yearly: "Annuelle",
};
