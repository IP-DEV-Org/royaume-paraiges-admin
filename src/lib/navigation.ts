import type { FeatureKey } from "@/lib/features";
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
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Fonctionnalité désactivable par le super admin ; absent = toujours accessible (Dashboard). */
  featureKey?: FeatureKey;
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
      { name: "Analytics", href: "/analytics", icon: BarChart3, featureKey: "analytics" },
      { name: "Réconciliation Cashpad", href: "/reconciliation", icon: Scale, featureKey: "reconciliation" },
    ],
  },
  {
    title: "Activité",
    items: [
      { name: "Utilisateurs", href: "/users", icon: Users, featureKey: "users" },
      { name: "Tickets de caisse", href: "/receipts", icon: Receipt, featureKey: "receipts" },
      { name: "Coupons", href: "/coupons", icon: Ticket, featureKey: "coupons" },
      { name: "Bonus cashback", href: "/rewards/cashback-gains", icon: Coins, featureKey: "cashback-gains" },
      { name: "Historique de distribution", href: "/history", icon: History, featureKey: "history" },
    ],
  },
  {
    title: "Gamification",
    items: [
      { name: "Quêtes", href: "/quests", icon: Target, featureKey: "quests" },
      { name: "Paliers & saison", href: "/rewards", icon: Trophy, featureKey: "rewards" },
      { name: "Badges", href: "/rewards/achievements", icon: Award, featureKey: "achievements" },
      { name: "Niveaux & lore", href: "/content/storytelling", icon: BookOpen, featureKey: "storytelling" },
      { name: "Modèles de coupons", href: "/templates", icon: FileText, featureKey: "templates" },
    ],
  },
  {
    title: "Contenu",
    items: [
      { name: "Bières", href: "/content/beers", icon: Beer, featureKey: "beers" },
      { name: "Établissements", href: "/content/establishments", icon: Building2, featureKey: "establishments" },
    ],
  },
  {
    title: "Système",
    items: [
      { name: "RGPD", href: "/gdpr", icon: Shield, featureKey: "gdpr" },
      { name: "Documentation", href: "/documentation", icon: BookText, featureKey: "documentation" },
      { name: "Paramètres", href: "/settings", icon: SettingsIcon, featureKey: "settings" },
    ],
  },
];

// Libellés des segments d'URL non couverts par la navigation principale,
// utilisés pour construire le fil d'Ariane.
export const segmentLabels: Record<string, string> = {
  analytics: "Analytics",
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
  access: "Gestion des accès",
  create: "Créer",
  weekly: "Hebdomadaire",
  monthly: "Mensuelle",
  yearly: "Annuelle",
};
