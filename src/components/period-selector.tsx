"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, Check } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// --- Period types & helpers ---

export type PeriodPreset =
  | "all_time"
  | "current_week"
  | "last_week"
  | "last_7_days"
  | "last_30_days"
  | "current_month"
  | "last_month"
  | "custom";

export interface PeriodDates {
  startDate: string; // ISO string
  endDate: string;   // ISO string
}

const PRESET_LABELS: Record<Exclude<PeriodPreset, "custom">, string> = {
  all_time: "Depuis le début",
  current_week: "Semaine en cours",
  last_week: "Semaine dernière",
  last_7_days: "7 derniers jours",
  last_30_days: "30 derniers jours",
  current_month: "Mois en cours",
  last_month: "Mois précédent",
};

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getPresetDates(key: Exclude<PeriodPreset, "custom">): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (key) {
    case "all_time": {
      const start = new Date(2026, 0, 1); // 1er janvier 2026
      const end = new Date(today);
      end.setDate(end.getDate() + 1);
      return { start, end };
    }
    case "current_week": {
      const monday = getMonday(today);
      const nextMonday = new Date(monday);
      nextMonday.setDate(nextMonday.getDate() + 7);
      return { start: monday, end: nextMonday };
    }
    case "last_week": {
      const monday = getMonday(today);
      monday.setDate(monday.getDate() - 7);
      const nextMonday = new Date(monday);
      nextMonday.setDate(nextMonday.getDate() + 7);
      return { start: monday, end: nextMonday };
    }
    case "last_7_days": {
      const start = new Date(today);
      start.setDate(start.getDate() - 7);
      const end = new Date(today);
      end.setDate(end.getDate() + 1);
      return { start, end };
    }
    case "last_30_days": {
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      const end = new Date(today);
      end.setDate(end.getDate() + 1);
      return { start, end };
    }
    case "current_month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      return { start, end };
    }
    case "last_month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start, end };
    }
  }
}

function formatDisplayDate(d: Date): string {
  return format(d, "d MMM yyyy", { locale: fr });
}

// --- Component ---

interface PeriodSelectorProps {
  onPeriodChange: (dates: PeriodDates) => void;
  defaultPreset?: PeriodPreset;
}

export function PeriodSelector({
  onPeriodChange,
  defaultPreset = "all_time",
}: PeriodSelectorProps) {
  const [preset, setPreset] = useState<PeriodPreset>(defaultPreset);

  // Confirmed custom dates (applied)
  const [confirmedStart, setConfirmedStart] = useState<Date | undefined>();
  const [confirmedEnd, setConfirmedEnd] = useState<Date | undefined>();

  // Draft range in the calendar popover (not yet applied)
  const [draftRange, setDraftRange] = useState<DateRange | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const emitChange = useCallback(
    (start: Date, end: Date) => {
      onPeriodChange({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
    },
    [onPeriodChange]
  );

  // Emit initial dates on mount
  const hasMounted = useRef(false);
  useEffect(() => {
    if (hasMounted.current) return;
    hasMounted.current = true;
    if (defaultPreset !== "custom") {
      const { start, end } = getPresetDates(defaultPreset);
      emitChange(start, end);
    }
    // Mount-only init: defaultPreset/emitChange must not retrigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePresetChange = useCallback(
    (value: string) => {
      const key = value as PeriodPreset;
      setPreset(key);
      if (key === "custom") {
        setCalendarOpen(true);
      } else {
        const { start, end } = getPresetDates(key);
        emitChange(start, end);
      }
    },
    [emitChange]
  );

  const openCalendar = useCallback(() => {
    // Initialize draft from confirmed custom dates if available
    if (confirmedStart) {
      setDraftRange({ from: confirmedStart, to: confirmedEnd });
    } else {
      setDraftRange(undefined);
    }
    setPreset("custom");
    setCalendarOpen(true);
  }, [confirmedStart, confirmedEnd]);

  const handleValidate = useCallback(() => {
    if (!draftRange?.from) return;

    const start = new Date(draftRange.from);
    start.setHours(0, 0, 0, 0);

    // Single date selected → that day only
    // Range selected → from start to end (inclusive)
    const endDate = draftRange.to ?? draftRange.from;
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    setConfirmedStart(start);
    setConfirmedEnd(end);
    setCalendarOpen(false);

    // end is exclusive for the API (next day at midnight)
    const exclusiveEnd = new Date(end);
    exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);
    emitChange(start, exclusiveEnd);
  }, [draftRange, emitChange]);

  // Compute display dates
  const currentDates = useMemo(() => {
    if (preset === "custom") {
      if (confirmedStart && confirmedEnd) {
        return { start: confirmedStart, end: confirmedEnd };
      }
      return null;
    }
    return getPresetDates(preset);
  }, [preset, confirmedStart, confirmedEnd]);

  // For presets, end is exclusive → show end - 1 day
  // For custom, confirmedEnd is already inclusive
  const displayEnd = useMemo(() => {
    if (!currentDates) return null;
    if (preset === "custom") return currentDates.end;
    const d = new Date(currentDates.end);
    d.setDate(d.getDate() - 1);
    return d;
  }, [currentDates, preset]);

  const isSingleDay =
    currentDates &&
    displayEnd &&
    currentDates.start.getTime() === displayEnd.getTime();

  return (
    <div className="flex flex-col gap-1">
      {/* Preset selector + calendar icon */}
      <div className="flex items-center">
        <Select value={preset} onValueChange={handlePresetChange}>
          <SelectTrigger className="w-[140px] rounded-r-none border-r-0 sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PRESET_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
            <SelectItem value="custom">Personnalisé</SelectItem>
          </SelectContent>
        </Select>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="rounded-l-none border-l-0"
              onClick={openCalendar}
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={draftRange}
              onSelect={setDraftRange}
              numberOfMonths={1}
              defaultMonth={draftRange?.from}
            />
            <div className="border-t px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {draftRange?.from
                  ? draftRange.to
                    ? `${formatDisplayDate(draftRange.from)} → ${formatDisplayDate(draftRange.to)}`
                    : formatDisplayDate(draftRange.from)
                  : "Selectionnez une ou deux dates"}
              </span>
              <Button
                size="sm"
                disabled={!draftRange?.from}
                onClick={handleValidate}
              >
                <Check className="mr-1 h-4 w-4" />
                Valider
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Date range display below */}
      {currentDates && displayEnd && (
        <span className="text-xs text-muted-foreground text-right">
          {isSingleDay
            ? formatDisplayDate(currentDates.start)
            : `${formatDisplayDate(currentDates.start)} → ${formatDisplayDate(displayEnd)}`}
        </span>
      )}
    </div>
  );
}
