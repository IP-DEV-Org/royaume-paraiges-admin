"use client";

import { Infinity as InfinityIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { QuestWithRelations, PeriodType } from "@/types/database";
import { QuestCard } from "./quest-card";
import { PERIOD_TYPES } from "./quest-display";

interface PermanentQuestsSectionProps {
  /** Quêtes sans planning (`quest_periods` vide), groupées par type de période. */
  permanentByType: Record<PeriodType, QuestWithRelations[]>;
  togglePending: boolean;
  duplicatingId: number | null;
  onToggleActive: (id: number, isActive: boolean) => void;
  onDuplicate: (id: number) => void;
}

export function PermanentQuestsSection({
  permanentByType,
  togglePending,
  duplicatingId,
  onToggleActive,
  onDuplicate,
}: PermanentQuestsSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <InfinityIcon className="h-4 w-4 text-amber-600" />
          Permanentes — actives à chaque période
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {PERIOD_TYPES.filter(
          ({ type }) => permanentByType[type].length > 0,
        ).map(({ type, label }) => (
          <div key={type} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {permanentByType[type].map((quest) => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  permanent
                  togglePending={togglePending}
                  duplicating={duplicatingId === quest.id}
                  onToggleActive={onToggleActive}
                  onDuplicate={onDuplicate}
                />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
