import {
  Target,
  Zap,
  MapPin,
  Receipt,
  ShoppingCart,
  CheckCircle2,
  Beer,
} from "lucide-react";
import type {
  QuestWithRelations,
  PeriodType,
  QuestType,
} from "@/types/database";

export const PERIOD_TYPES: { type: PeriodType; label: string }[] = [
  { type: "weekly", label: "Semaine" },
  { type: "monthly", label: "Mois" },
  { type: "yearly", label: "Année" },
];

export const periodTypeLabels: Record<PeriodType, string> = {
  weekly: "Semaine",
  monthly: "Mois",
  yearly: "Année",
};

export const questTypeLabels: Record<QuestType, string> = {
  xp_earned: "Gagner de l'XP",
  amount_spent: "Dépenser de l'argent",
  cashback_earned: "Collecter des Paraiges de Bronze",
  establishments_visited: "Visiter des établissements",
  orders_count: "Passer des commandes",
  quest_completed: "Compléter des quêtes",
  consumption_count: "Consommer un type de produit",
};

export const questTypeIcons: Record<QuestType, typeof Target> = {
  xp_earned: Zap,
  amount_spent: Receipt,
  cashback_earned: Receipt,
  establishments_visited: MapPin,
  orders_count: ShoppingCart,
  quest_completed: CheckCircle2,
  consumption_count: Beer,
};

export function objectiveUnit(quest: QuestWithRelations): string {
  switch (quest.quest_type) {
    case "xp_earned":
      return "XP";
    case "cashback_earned":
      return "PdB";
    case "establishments_visited":
      return "établissements";
    case "orders_count":
      return "commandes";
    case "quest_completed":
      return "sous-périodes";
    case "consumption_count":
      return quest.consumption_type ?? "produits";
    default:
      return "";
  }
}
