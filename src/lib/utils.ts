import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function formatPercentage(value: number): string {
  return `${value}%`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function getPeriodIdentifier(
  periodType: "weekly" | "monthly" | "yearly",
  date: Date = new Date()
): string {
  const year = date.getFullYear();

  if (periodType === "yearly") {
    return `${year}`;
  }

  if (periodType === "monthly") {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  // Weekly — semaine ISO 8601 (lundi → dimanche), strictement alignée sur la
  // fonction SQL get_period_identifier (`to_char(date,'IYYY-"W"IW')`). Une autre
  // convention (ex. dimanche → samedi) décale les labels d'un jour le dimanche
  // et casse le rattachement quest_periods / quest_progress / leaderboards.
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNum = (d.getDay() + 6) % 7; // lundi=0 … dimanche=6
  d.setDate(d.getDate() - dayNum + 3); // jeudi de la semaine ISO courante
  const isoYear = d.getFullYear(); // peut différer de l'année civile au nouvel an
  const firstThursday = new Date(isoYear, 0, 4); // le 4 janvier ∈ semaine ISO 1
  const ftDayNum = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - ftDayNum + 3);
  const weekNumber =
    1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${isoYear}-W${String(weekNumber).padStart(2, "0")}`;
}
