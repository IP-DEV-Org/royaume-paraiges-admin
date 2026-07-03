"use client";

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

// =============================================================================
// Sélecteur de période partagé (Jour / Semaine / Mois) — analytics, réconciliation.
// Les bornes sont des dates calendaires YYYY-MM-DD ; le rattachement fiscal est
// fait côté backend (RPC / Edge Function). Composant contrôlé : la page détient
// `mode` + `date` et calcule ses bornes via `getPeriodBounds`.
// Convention semaine = ISO 8601 (lundi → dimanche), comme partout dans le projet
// — ne jamais réintroduire un calcul de semaine dimanche → samedi.
// =============================================================================

export type PeriodMode = "day" | "week" | "month" | "year";

/** Modes proposés par défaut — « year » est opt-in via la prop `modes`. */
const DEFAULT_MODES: PeriodMode[] = ["day", "week", "month"];

const MODE_LABELS: Record<PeriodMode, string> = {
  day: "Jour",
  week: "Semaine",
  month: "Mois",
  year: "Année",
};

export function todayUtcISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Conversions entre date YYYY-MM-DD et formats d'input HTML5 ──

function dateToWeekValue(dateISO: string): string {
  // Format ISO week "YYYY-Www" — calculé sur le jeudi de la semaine.
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function weekValueToDate(weekValue: string): string {
  // "YYYY-Www" → date du lundi de la semaine ISO.
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
  } else if (mode === "month") {
    d.setUTCMonth(d.getUTCMonth() + dir);
  } else {
    d.setUTCFullYear(d.getUTCFullYear() + dir);
  }
  return d.toISOString().slice(0, 10);
}

/** True si la période contenant `dateISO` inclut today (donc next doit être disabled). */
export function isPeriodAtMax(dateISO: string, mode: PeriodMode): boolean {
  const today = todayUtcISO();
  if (mode === "day") return dateISO >= today;
  if (mode === "week") return dateToWeekValue(dateISO) >= dateToWeekValue(today);
  if (mode === "month") return dateToMonthValue(dateISO) >= dateToMonthValue(today);
  return dateISO.slice(0, 4) >= today.slice(0, 4);
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
    // Lundi → dimanche (ISO). getUTCDay() : 0=dim, 1=lun, ... 6=sam
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
  if (mode === "month") {
    // 1er → dernier jour du mois civil
    const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return {
      startDate: first.toISOString().slice(0, 10),
      endDate: last.toISOString().slice(0, 10),
    };
  }
  // year — 1er janvier → 31 décembre
  const year = d.getUTCFullYear();
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

export function formatPeriodLabel(
  mode: PeriodMode,
  startDate: string,
  endDate: string
): string {
  if (mode === "day") return formatDate(`${startDate}T00:00:00Z`);
  if (mode === "year") return startDate.slice(0, 4);
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

/** Ouvre la modale native du picker au clic n'importe où sur l'input. */
function openPickerOnClick(e: React.MouseEvent<HTMLInputElement>) {
  const input = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
  input.showPicker?.();
}

// ── Briques composables ──────────────────────────────────────────────────────

interface PeriodModeToggleProps {
  mode: PeriodMode;
  onModeChange: (mode: PeriodMode) => void;
  /** Modes proposés (défaut Jour / Semaine / Mois — « year » est opt-in). */
  modes?: PeriodMode[];
}

/** Pills Jour / Semaine / Mois (/ Année si opt-in via `modes`). */
export function PeriodModeToggle({
  mode,
  onModeChange,
  modes = DEFAULT_MODES,
}: PeriodModeToggleProps) {
  return (
    <div className="flex gap-1 rounded-md border bg-muted/30 p-1">
      {modes.map((m) => (
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
          {MODE_LABELS[m]}
        </button>
      ))}
    </div>
  );
}

interface PeriodDateNavProps {
  mode: PeriodMode;
  date: string;
  onDateChange: (date: string) => void;
  /** Largeur de l'input (défaut layout inline analytics). */
  inputClassName?: string;
  /** Affiche le bouton « Aujourd'hui ». */
  showToday?: boolean;
}

/** Navigation ‹ input ›, picker natif borné à aujourd'hui. */
export function PeriodDateNav({
  mode,
  date,
  onDateChange,
  inputClassName = "w-[150px] cursor-pointer",
  showToday = false,
}: PeriodDateNavProps) {
  return (
    <div className="flex items-stretch gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() => onDateChange(shiftPeriod(date, mode, -1))}
        aria-label="Période précédente"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>

      {mode === "day" && (
        <Input
          type="date"
          value={date}
          onChange={(e) => e.target.value && onDateChange(e.target.value)}
          onClick={openPickerOnClick}
          max={todayUtcISO()}
          className={inputClassName}
        />
      )}
      {mode === "week" && (
        <Input
          type="week"
          value={dateToWeekValue(date)}
          onChange={(e) => e.target.value && onDateChange(weekValueToDate(e.target.value))}
          onClick={openPickerOnClick}
          max={dateToWeekValue(todayUtcISO())}
          className={inputClassName}
        />
      )}
      {mode === "month" && (
        <Input
          type="month"
          value={dateToMonthValue(date)}
          onChange={(e) => e.target.value && onDateChange(monthValueToDate(e.target.value))}
          onClick={openPickerOnClick}
          max={dateToMonthValue(todayUtcISO())}
          className={inputClassName}
        />
      )}
      {mode === "year" && (
        // Pas d'input HTML5 « year » : saisie numérique bornée à l'année courante.
        <Input
          type="number"
          value={date.slice(0, 4)}
          onChange={(e) => {
            const y = parseInt(e.target.value, 10);
            if (y >= 2020 && y <= parseInt(todayUtcISO().slice(0, 4), 10)) {
              onDateChange(`${y}-01-01`);
            }
          }}
          min={2020}
          max={todayUtcISO().slice(0, 4)}
          className={inputClassName}
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
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>

      {showToday && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5"
          onClick={() => onDateChange(todayUtcISO())}
          title="Revenir à aujourd'hui"
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          Aujourd&apos;hui
        </Button>
      )}
    </div>
  );
}

interface PeriodRangeProps {
  mode: PeriodMode;
  date: string;
  onModeChange: (mode: PeriodMode) => void;
  onDateChange: (date: string) => void;
  /** Modes proposés (défaut Jour / Semaine / Mois — « year » est opt-in). */
  modes?: PeriodMode[];
}

/** Layout inline complet : toggle + navigation + label de la période. */
export function PeriodRange({
  mode,
  date,
  onModeChange,
  onDateChange,
  modes,
}: PeriodRangeProps) {
  const { startDate, endDate } = getPeriodBounds(mode, date);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <PeriodModeToggle mode={mode} onModeChange={onModeChange} modes={modes} />
      <PeriodDateNav mode={mode} date={date} onDateChange={onDateChange} showToday />
      <p className="px-1 text-xs text-muted-foreground sm:self-center">
        {formatPeriodLabel(mode, startDate, endDate)}
      </p>
    </div>
  );
}
