"use client";

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// =============================================================================
// Sélecteur de plage pour la timeline analytics (Jour / Semaine / Mois).
// Réplique le pattern de la page réconciliation : les bornes sont des dates
// calendaires YYYY-MM-DD, la RPC se charge ensuite du rattachement fiscal.
// Composant contrôlé : la page détient `mode` + `date`, calcule les bornes via
// `getPeriodBounds` exporté ici.
// =============================================================================

export type PeriodMode = "day" | "week" | "month";

export function todayUtcISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateToWeekValue(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function weekValueToDate(weekValue: string): string {
  const match = weekValue.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return todayUtcISO();
  const year = parseInt(match[1] ?? "", 10);
  const week = parseInt(match[2] ?? "", 10);
  if (!year || !week) return todayUtcISO();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

function dateToMonthValue(dateISO: string): string {
  return dateISO.slice(0, 7);
}

function monthValueToDate(monthValue: string): string {
  return `${monthValue}-01`;
}

/** Décale la date d'une unité (jour / semaine / mois) dans une direction donnée. */
export function shiftPeriod(dateISO: string, mode: PeriodMode, dir: -1 | 1): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  if (mode === "day") {
    d.setUTCDate(d.getUTCDate() + dir);
  } else if (mode === "week") {
    d.setUTCDate(d.getUTCDate() + dir * 7);
  } else {
    d.setUTCMonth(d.getUTCMonth() + dir);
  }
  return d.toISOString().slice(0, 10);
}

/** True si la période contenant `dateISO` inclut today (donc next doit être disabled). */
export function isPeriodAtMax(dateISO: string, mode: PeriodMode): boolean {
  const today = todayUtcISO();
  if (mode === "day") return dateISO >= today;
  if (mode === "week") return dateToWeekValue(dateISO) >= dateToWeekValue(today);
  return dateToMonthValue(dateISO) >= dateToMonthValue(today);
}

/** Bornes calendaires [startDate, endDate] (YYYY-MM-DD) de la période. */
export function getPeriodBounds(
  mode: PeriodMode,
  dateISO: string
): { startDate: string; endDate: string } {
  if (mode === "day") {
    return { startDate: dateISO, endDate: dateISO };
  }
  const d = new Date(`${dateISO}T00:00:00Z`);
  if (mode === "week") {
    const dow = d.getUTCDay();
    const offsetToMonday = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() + offsetToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
      startDate: monday.toISOString().slice(0, 10),
      endDate: sunday.toISOString().slice(0, 10),
    };
  }
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return {
    startDate: first.toISOString().slice(0, 10),
    endDate: last.toISOString().slice(0, 10),
  };
}

export function formatPeriodLabel(
  mode: PeriodMode,
  startDate: string,
  endDate: string
): string {
  if (mode === "day") return new Date(`${startDate}T00:00:00Z`).toLocaleDateString("fr-FR");
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
    });
  if (mode === "month") {
    return new Date(`${startDate}T00:00:00Z`).toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });
  }
  return `${fmt(startDate)} → ${fmt(endDate)}`;
}

function openPickerOnClick(e: React.MouseEvent<HTMLInputElement>) {
  const input = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
  input.showPicker?.();
}

interface TimelinePeriodRangeProps {
  mode: PeriodMode;
  date: string;
  onModeChange: (mode: PeriodMode) => void;
  onDateChange: (date: string) => void;
}

export function TimelinePeriodRange({
  mode,
  date,
  onModeChange,
  onDateChange,
}: TimelinePeriodRangeProps) {
  const { startDate, endDate } = getPeriodBounds(mode, date);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex gap-1 rounded-md border bg-muted/30 p-1">
        {(["day", "week", "month"] as PeriodMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className={`flex-1 rounded px-3 py-1 text-xs font-medium transition-colors ${
              mode === m
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "day" ? "Jour" : m === "week" ? "Semaine" : "Mois"}
          </button>
        ))}
      </div>

      <div className="flex items-stretch gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onDateChange(shiftPeriod(date, mode, -1))}
          aria-label="Période précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {mode === "day" && (
          <Input
            type="date"
            value={date}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
            onClick={openPickerOnClick}
            max={todayUtcISO()}
            className="w-[150px] cursor-pointer"
          />
        )}
        {mode === "week" && (
          <Input
            type="week"
            value={dateToWeekValue(date)}
            onChange={(e) => e.target.value && onDateChange(weekValueToDate(e.target.value))}
            onClick={openPickerOnClick}
            max={dateToWeekValue(todayUtcISO())}
            className="w-[150px] cursor-pointer"
          />
        )}
        {mode === "month" && (
          <Input
            type="month"
            value={dateToMonthValue(date)}
            onChange={(e) => e.target.value && onDateChange(monthValueToDate(e.target.value))}
            onClick={openPickerOnClick}
            max={dateToMonthValue(todayUtcISO())}
            className="w-[150px] cursor-pointer"
          />
        )}

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onDateChange(shiftPeriod(date, mode, 1))}
          disabled={isPeriodAtMax(date, mode)}
          aria-label="Période suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5"
          onClick={() => onDateChange(todayUtcISO())}
          title="Revenir à aujourd'hui"
        >
          <CalendarDays className="h-4 w-4" />
          Aujourd&apos;hui
        </Button>
      </div>

      <p className="px-1 text-xs text-muted-foreground sm:self-center">
        {formatPeriodLabel(mode, startDate, endDate)}
      </p>
    </div>
  );
}
