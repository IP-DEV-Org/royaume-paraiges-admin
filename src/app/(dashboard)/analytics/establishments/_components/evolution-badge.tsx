"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Évolution en % entre deux périodes. `pct` null quand la période précédente
 * est vide (division par zéro) — affiché « — » (up si du volume est apparu).
 * Même logique que le TrendBadge du dashboard.
 */
export function trendDelta(
  current: number,
  previous: number
): { pct: number | null; direction: "up" | "down" | "flat" } {
  if (previous === 0) {
    if (current === 0) return { pct: null, direction: "flat" };
    return { pct: null, direction: "up" };
  }
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  if (Math.abs(pct) < 0.5) return { pct: 0, direction: "flat" };
  return { pct, direction: pct > 0 ? "up" : "down" };
}

export function formatTrend(pct: number | null): string {
  return pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct.toLocaleString("fr-FR")}%`;
}

export function EvolutionBadge({
  current,
  previous,
}: {
  current: number;
  /** null = période précédente inconnue (chargement) → rien d'affiché. */
  previous: number | null;
}) {
  if (previous === null) return null;
  const { pct, direction } = trendDelta(current, previous);
  const Icon =
    direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  const color =
    direction === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : direction === "down"
        ? "text-rose-600 dark:text-rose-400"
        : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", color)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {formatTrend(pct)}
    </span>
  );
}
