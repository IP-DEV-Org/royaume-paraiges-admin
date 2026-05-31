import { createClient } from "@/lib/supabase/client";
import { getPeriodIdentifier } from "@/lib/utils";
import type { AvailablePeriod, PeriodType } from "@/types/database";

// Récupérer toutes les périodes disponibles
export async function getAvailablePeriods(
  periodType?: PeriodType
): Promise<AvailablePeriod[]> {
  const supabase = createClient();
  let query = supabase
    .from("available_periods")
    .select("*")
    .order("period_identifier", { ascending: true });

  if (periodType) {
    query = query.eq("period_type", periodType);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as AvailablePeriod[];
}

// Récupérer les périodes par type avec pagination optionnelle
export async function getAvailablePeriodsByType(
  periodType: PeriodType,
  options?: {
    limit?: number;
    offset?: number;
    year?: number;
  }
): Promise<AvailablePeriod[]> {
  const supabase = createClient();
  let query = supabase
    .from("available_periods")
    .select("*")
    .eq("period_type", periodType)
    .order("period_identifier", { ascending: true });

  // Filtrer par année si spécifié
  if (options?.year) {
    const yearStr = options.year.toString();
    query = query.like("period_identifier", `${yearStr}%`);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as AvailablePeriod[];
}

// Récupérer une période par son identifiant
export async function getAvailablePeriod(
  periodType: PeriodType,
  periodIdentifier: string
): Promise<AvailablePeriod | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("available_periods")
    .select("*")
    .eq("period_type", periodType)
    .eq("period_identifier", periodIdentifier)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as AvailablePeriod | null;
}

// Récupérer la période courante.
// Délègue à l'unique générateur de labels `getPeriodIdentifier` (src/lib/utils),
// qui suit la convention ISO 8601 alignée sur la SQL get_period_identifier.
// Ne PAS réintroduire de calcul de semaine local ailleurs dans l'admin.
export function getCurrentPeriodIdentifier(periodType: PeriodType): string {
  return getPeriodIdentifier(periodType);
}

// Récupérer les années disponibles
export async function getAvailableYears(): Promise<number[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("available_periods")
    .select("period_identifier")
    .eq("period_type", "yearly")
    .order("period_identifier");

  if (error) throw error;

  return ((data || []) as { period_identifier: string }[])
    .map((p) => parseInt(p.period_identifier))
    .filter((y) => !isNaN(y));
}

// Formater une période pour l'affichage
export function formatPeriodLabel(
  periodType: PeriodType,
  periodIdentifier: string
): string {
  switch (periodType) {
    case "weekly": {
      // 2026-W04 -> Semaine 4, 2026
      const match = periodIdentifier.match(/^(\d{4})-W(\d{2})$/);
      if (match && match[1] && match[2]) {
        return `Semaine ${parseInt(match[2])}, ${match[1]}`;
      }
      return periodIdentifier;
    }
    case "monthly": {
      // 2026-01 -> Janvier 2026
      const match = periodIdentifier.match(/^(\d{4})-(\d{2})$/);
      if (match && match[1] && match[2]) {
        const months = [
          "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
          "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
        ];
        const monthIndex = parseInt(match[2]) - 1;
        return `${months[monthIndex] ?? ""} ${match[1]}`;
      }
      return periodIdentifier;
    }
    case "yearly":
      return periodIdentifier;
  }
}

// Formater les dates d'une période
export function formatPeriodDates(period: AvailablePeriod): string {
  const startDate = new Date(period.start_date);
  const endDate = new Date(period.end_date);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });
  };

  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}
