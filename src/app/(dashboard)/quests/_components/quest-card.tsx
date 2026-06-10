"use client";

import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type { QuestProgressStats } from "@/lib/services/questService";
import { cn, formatCurrency, formatPercentage } from "@/lib/utils";
import type { QuestWithRelations } from "@/types/database";
import {
  questTypeIcons,
  questTypeLabels,
  objectiveUnit,
} from "./quest-display";

interface QuestCardProps {
  quest: QuestWithRelations;
  /** Période passée : remplace le toggle par les stats de participation. */
  past?: boolean;
  stats?: QuestProgressStats;
  /** Quête sans planning : badge "En continu" si active. */
  permanent?: boolean;
  togglePending: boolean;
  duplicating: boolean;
  onToggleActive: (id: number, isActive: boolean) => void;
  onDuplicate: (id: number) => void;
}

function QuestRewards({ quest }: { quest: QuestWithRelations }) {
  const hasReward =
    quest.coupon_templates ||
    quest.badge_types ||
    quest.bonus_xp > 0 ||
    quest.bonus_cashback > 0;
  if (!hasReward) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {quest.coupon_templates && (
        <Badge variant="secondary" className="text-[10px]">
          {quest.coupon_templates.amount
            ? formatCurrency(quest.coupon_templates.amount)
            : quest.coupon_templates.percentage
            ? formatPercentage(quest.coupon_templates.percentage)
            : quest.coupon_templates.name}
        </Badge>
      )}
      {quest.badge_types && (
        <Badge variant="secondary" className="text-[10px]">
          {quest.badge_types.name}
        </Badge>
      )}
      {quest.bonus_xp > 0 && (
        <Badge variant="outline" className="text-[10px]">
          +{quest.bonus_xp} XP
        </Badge>
      )}
      {quest.bonus_cashback > 0 && (
        <Badge variant="outline" className="text-[10px]">
          +{formatCurrency(quest.bonus_cashback)}
        </Badge>
      )}
    </div>
  );
}

function QuestParticipation({ stats }: { stats?: QuestProgressStats }) {
  if (!stats || stats.total === 0) {
    return (
      <span className="text-xs text-muted-foreground">Aucune participation</span>
    );
  }
  const success = stats.completed + stats.rewarded;
  return (
    <div className="flex items-center gap-1.5">
      <Badge
        variant="secondary"
        className="bg-emerald-100 text-emerald-800 text-[10px]"
      >
        {success} réussie{success > 1 ? "s" : ""}
      </Badge>
      {stats.expired > 0 && (
        <Badge
          variant="secondary"
          className="bg-red-100 text-red-800 text-[10px]"
        >
          {stats.expired} expirée{stats.expired > 1 ? "s" : ""}
        </Badge>
      )}
      <span className="text-[10px] text-muted-foreground">
        {stats.total} part.
      </span>
    </div>
  );
}

export function QuestCard({
  quest,
  past,
  stats,
  permanent,
  togglePending,
  duplicating,
  onToggleActive,
  onDuplicate,
}: QuestCardProps) {
  const router = useRouter();
  const Icon = questTypeIcons[quest.quest_type];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/quests/${quest.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/quests/${quest.id}`);
      }}
      className="group rounded-lg border bg-card p-3 space-y-2 cursor-pointer transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start gap-2">
        <Icon
          className={cn(
            "h-4 w-4 mt-0.5 shrink-0",
            quest.is_active ? "text-primary" : "text-muted-foreground",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-medium text-sm leading-tight">{quest.name}</p>
            {!quest.is_active && (
              <Badge
                variant="outline"
                className="text-[10px] text-muted-foreground"
              >
                Inactive
              </Badge>
            )}
            {permanent && quest.is_active && (
              <Badge
                variant="secondary"
                className="gap-1 bg-amber-100 text-amber-800 text-[10px]"
                title="Quête active sans planning : elle récompense à chaque période. Désactivez-la si elle ne doit plus tourner."
              >
                <AlertCircle className="h-3 w-3" />
                En continu
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {questTypeLabels[quest.quest_type]} ·{" "}
            <span className="font-medium text-foreground">
              {quest.quest_type === "amount_spent"
                ? formatCurrency(quest.target_value)
                : quest.target_value}{" "}
              {objectiveUnit(quest)}
            </span>
          </p>
        </div>
      </div>

      <QuestRewards quest={quest} />

      <div
        className="flex items-center justify-between pt-1"
        onClick={(e) => e.stopPropagation()}
      >
        {past ? (
          <QuestParticipation stats={stats} />
        ) : (
          <div className="flex items-center gap-1.5">
            <Switch
              checked={quest.is_active}
              disabled={togglePending}
              aria-label={
                quest.is_active ? "Désactiver la quête" : "Activer la quête"
              }
              onCheckedChange={(checked) => onToggleActive(quest.id, checked)}
            />
            <span className="text-[10px] text-muted-foreground">
              {quest.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        )}
        {!past && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Dupliquer la quête"
            aria-label="Dupliquer la quête"
            disabled={duplicating}
            onClick={() => onDuplicate(quest.id)}
          >
            {duplicating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
