"use client";

import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { QuestProgressStats } from "@/lib/services/questService";
import { formatPeriodLabel } from "@/lib/services/periodService";
import { cn } from "@/lib/utils";
import type { QuestWithRelations, PeriodType } from "@/types/database";
import { QuestCard } from "./quest-card";
import { shortPeriodLabel } from "./period-anchor";

interface PeriodSectionProps {
  type: PeriodType;
  label: string;
  /** Période actuellement sélectionnée dans la frise. */
  selectedPeriod: string;
  /** Période en cours (aujourd'hui). */
  currentPeriod: string;
  /** Périodes affichées dans la frise temporelle, triées. */
  frisePeriods: string[];
  /** Quêtes planifiées sur la période sélectionnée. */
  quests: QuestWithRelations[];
  /** Stats de participation par quest_id (périodes passées uniquement). */
  stats?: Map<number, QuestProgressStats>;
  onSelectPeriod: (periodId: string) => void;
  onResetToday: () => void;
  togglePending: boolean;
  duplicatingId: number | null;
  onToggleActive: (id: number, isActive: boolean) => void;
  onDuplicate: (id: number) => void;
}

export function PeriodSection({
  type,
  label,
  selectedPeriod,
  currentPeriod,
  frisePeriods,
  quests,
  stats,
  onSelectPeriod,
  onResetToday,
  togglePending,
  duplicatingId,
  onToggleActive,
  onDuplicate,
}: PeriodSectionProps) {
  const isPast = selectedPeriod < currentPeriod;
  const isFuture = selectedPeriod > currentPeriod;

  return (
    <div className="rounded-lg border bg-muted/20">
      <div className="border-b p-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <span className="font-semibold text-sm uppercase tracking-wide">
            {label}
          </span>
          {isPast && (
            <Badge variant="outline" className="text-[10px]">
              Passée
            </Badge>
          )}
          {isFuture && (
            <Badge
              variant="secondary"
              className="bg-blue-100 text-blue-800 text-[10px]"
            >
              À venir
            </Badge>
          )}
          {!isPast && !isFuture && (
            <Badge
              variant="secondary"
              className="bg-emerald-100 text-emerald-800 text-[10px]"
            >
              En cours
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {formatPeriodLabel(type, selectedPeriod)}
          </span>
          {selectedPeriod !== currentPeriod && (
            <button
              type="button"
              onClick={onResetToday}
              className="text-[10px] text-primary hover:underline whitespace-nowrap"
            >
              Aujourd&apos;hui
            </button>
          )}
        </div>
        <div className="lg:max-w-[60%]">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {frisePeriods.map((pid) => {
              const isSel = pid === selectedPeriod;
              const isCur = pid === currentPeriod;
              const isPastPid = pid < currentPeriod;
              return (
                <button
                  key={pid}
                  type="button"
                  onClick={() => onSelectPeriod(pid)}
                  title={formatPeriodLabel(type, pid)}
                  className={cn(
                    "shrink-0 rounded px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                    isSel
                      ? "bg-primary text-primary-foreground"
                      : isPastPid
                      ? "text-muted-foreground hover:bg-muted"
                      : "text-foreground hover:bg-muted",
                    isCur && !isSel && "ring-1 ring-primary/50",
                  )}
                >
                  {shortPeriodLabel(type, pid)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-3">
        {quests.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Aucune quête planifiée sur cette période."
            className="py-6"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {quests.map((quest) => (
              <QuestCard
                key={quest.id}
                quest={quest}
                past={isPast}
                stats={stats?.get(quest.id)}
                togglePending={togglePending}
                duplicating={duplicatingId === quest.id}
                onToggleActive={onToggleActive}
                onDuplicate={onDuplicate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
