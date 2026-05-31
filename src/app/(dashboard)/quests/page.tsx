"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Loader2,
  Target,
  Zap,
  MapPin,
  Receipt,
  ShoppingCart,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
  FileDown,
  Beer,
  Copy,
  Wrench,
  ChevronDown,
  CalendarClock,
  Infinity as InfinityIcon,
} from "lucide-react";
import {
  getQuests,
  toggleQuestActive,
  duplicateQuest,
  generateQuestsCsvTemplate,
  exportQuestsToCsv,
  parseQuestsCsv,
  importQuestsFromCsv,
  getQuestProgressStatsForPeriod,
  type QuestCsvRow,
  type QuestProgressStats,
} from "@/lib/services/questService";
import {
  parseQuestRedundancyError,
  type QuestRedundancyDetails,
} from "@/lib/supabase/errorParser";
import { QuestConflictDialog } from "@/components/quest-conflict-dialog";
import { questKeys } from "@/lib/queries/keys";
import {
  getCurrentPeriodIdentifier,
  formatPeriodLabel,
} from "@/lib/services/periodService";
import {
  cn,
  formatCurrency,
  formatPercentage,
  getPeriodIdentifier,
} from "@/lib/utils";
import type {
  QuestWithRelations,
  PeriodType,
  QuestType,
} from "@/types/database";

const PERIOD_TYPES: { type: PeriodType; label: string }[] = [
  { type: "weekly", label: "Semaine" },
  { type: "monthly", label: "Mois" },
  { type: "yearly", label: "Année" },
];

const periodTypeLabels: Record<PeriodType, string> = {
  weekly: "Semaine",
  monthly: "Mois",
  yearly: "Année",
};

const questTypeLabels: Record<QuestType, string> = {
  xp_earned: "Gagner de l'XP",
  amount_spent: "Dépenser de l'argent",
  cashback_earned: "Collecter des Paraiges de Bronze",
  establishments_visited: "Visiter des établissements",
  orders_count: "Passer des commandes",
  quest_completed: "Compléter des quêtes",
  consumption_count: "Consommer un type de produit",
};

const questTypeIcons: Record<QuestType, typeof Target> = {
  xp_earned: Zap,
  amount_spent: Receipt,
  cashback_earned: Receipt,
  establishments_visited: MapPin,
  orders_count: ShoppingCart,
  quest_completed: CheckCircle2,
  consumption_count: Beer,
};

const MONTHS_SHORT = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc",
];

/** Libellé court d'une période pour la frise (ex. "S22", "Mai", "2026"). */
function shortPeriodLabel(type: PeriodType, id: string): string {
  if (type === "weekly") {
    const m = id.match(/W(\d{2})$/);
    return m && m[1] ? `S${parseInt(m[1])}` : id;
  }
  if (type === "monthly") {
    const m = id.match(/-(\d{2})$/);
    return m && m[1] ? MONTHS_SHORT[parseInt(m[1]) - 1] ?? id : id;
  }
  return id;
}

/** Jeudi (milieu ISO) de la semaine "YYYY-Www" — détermine sans ambiguïté son mois/année. */
function isoWeekThursday(id: string): Date | null {
  const m = id.match(/^(\d{4})-W(\d{2})$/);
  if (!m || !m[1] || !m[2]) return null;
  const isoYear = parseInt(m[1]);
  const week = parseInt(m[2]);
  const jan4 = new Date(isoYear, 0, 4); // le 4 janvier ∈ semaine ISO 1
  const jan4Day = (jan4.getDay() + 6) % 7; // lundi=0 … dimanche=6
  const week1Monday = new Date(isoYear, 0, 4 - jan4Day);
  const thursday = new Date(week1Monday);
  thursday.setDate(week1Monday.getDate() + (week - 1) * 7 + 3);
  return thursday;
}

/**
 * Convertit la période cliquée en date pivot (anchor). Les 3 frises (semaine /
 * mois / année) dérivent toutes de cet anchor → elles restent toujours alignées.
 * On préserve la sélection plus fine quand elle reste cohérente (changer d'année
 * garde le mois, changer de mois garde la semaine si elle y tombe déjà).
 */
function periodToAnchor(type: PeriodType, id: string, prev: Date): Date {
  if (type === "weekly") {
    return isoWeekThursday(id) ?? prev;
  }
  if (type === "monthly") {
    const m = id.match(/^(\d{4})-(\d{2})$/);
    if (!m || !m[1] || !m[2]) return prev;
    const year = parseInt(m[1]);
    const month = parseInt(m[2]) - 1;
    if (prev.getFullYear() === year && prev.getMonth() === month) return prev;
    return new Date(year, month, 15); // mi-mois : semaine non ambiguë
  }
  // yearly
  const year = parseInt(id);
  if (isNaN(year)) return prev;
  if (prev.getFullYear() === year) return prev;
  return new Date(year, prev.getMonth(), Math.min(prev.getDate(), 28));
}

function objectiveUnit(quest: QuestWithRelations): string {
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

function downloadCsv(content: string, filename: string) {
  const BOM = "﻿";
  const blob = new Blob([BOM + content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function QuestsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [currentIds] = useState<Record<PeriodType, string>>(() => ({
    weekly: getCurrentPeriodIdentifier("weekly"),
    monthly: getCurrentPeriodIdentifier("monthly"),
    yearly: getCurrentPeriodIdentifier("yearly"),
  }));
  // Date pivot unique : les 3 périodes affichées en dérivent (toujours alignées).
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const selectedPeriods = useMemo<Record<PeriodType, string>>(
    () => ({
      weekly: getPeriodIdentifier("weekly", anchor),
      monthly: getPeriodIdentifier("monthly", anchor),
      yearly: getPeriodIdentifier("yearly", anchor),
    }),
    [anchor],
  );

  const [showInactive, setShowInactive] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<QuestCsvRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [conflictDetails, setConflictDetails] =
    useState<QuestRedundancyDetails | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    data: quests = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: questKeys.lists(),
    queryFn: () => getQuests(),
  });

  if (error) {
    console.error(error);
  }

  // Filtre actives/inactives appliqué en amont de tous les regroupements.
  const visibleQuests = useMemo(
    () => (showInactive ? quests : quests.filter((q) => q.is_active)),
    [quests, showInactive],
  );

  const { permanentByType, friseByType, scheduledByType } = useMemo(() => {
    const permanent: Record<PeriodType, QuestWithRelations[]> = {
      weekly: [],
      monthly: [],
      yearly: [],
    };
    const friseSets: Record<PeriodType, Set<string>> = {
      weekly: new Set([currentIds.weekly, selectedPeriods.weekly]),
      monthly: new Set([currentIds.monthly, selectedPeriods.monthly]),
      yearly: new Set([currentIds.yearly, selectedPeriods.yearly]),
    };
    const scheduled: Record<PeriodType, QuestWithRelations[]> = {
      weekly: [],
      monthly: [],
      yearly: [],
    };

    for (const quest of visibleQuests) {
      const type = quest.period_type as PeriodType;
      if (!(type in permanent)) continue;
      const periods = quest.quest_periods ?? [];
      if (periods.length === 0) {
        permanent[type].push(quest);
        continue;
      }
      for (const p of periods) friseSets[type].add(p.period_identifier);
      if (periods.some((p) => p.period_identifier === selectedPeriods[type])) {
        scheduled[type].push(quest);
      }
    }

    const frise: Record<PeriodType, string[]> = {
      weekly: [...friseSets.weekly].sort(),
      monthly: [...friseSets.monthly].sort(),
      yearly: [...friseSets.yearly].sort(),
    };

    const byOrder = (a: QuestWithRelations, b: QuestWithRelations) =>
      a.display_order - b.display_order;
    for (const t of PERIOD_TYPES) {
      permanent[t.type].sort(byOrder);
      scheduled[t.type].sort(byOrder);
    }

    return {
      permanentByType: permanent,
      friseByType: frise,
      scheduledByType: scheduled,
    };
  }, [visibleQuests, selectedPeriods, currentIds]);

  // Stats de participation pour les colonnes pointant sur une période passée.
  const pastStatsSignature = PERIOD_TYPES.map(({ type }) => {
    const isPast = selectedPeriods[type] < currentIds[type];
    if (!isPast) return `${type}:`;
    return `${type}:${selectedPeriods[type]}:${scheduledByType[type]
      .map((q) => q.id)
      .join(",")}`;
  }).join("|");

  const { data: statsByType } = useQuery({
    queryKey: [...questKeys.all, "period-stats", pastStatsSignature],
    queryFn: async () => {
      const result: Record<PeriodType, Map<number, QuestProgressStats>> = {
        weekly: new Map(),
        monthly: new Map(),
        yearly: new Map(),
      };
      await Promise.all(
        PERIOD_TYPES.map(async ({ type }) => {
          if (selectedPeriods[type] >= currentIds[type]) return;
          const ids = scheduledByType[type].map((q) => q.id);
          if (ids.length === 0) return;
          result[type] = await getQuestProgressStatsForPeriod(
            ids,
            selectedPeriods[type],
          );
        }),
      );
      return result;
    },
    enabled: PERIOD_TYPES.some(
      ({ type }) =>
        selectedPeriods[type] < currentIds[type] &&
        scheduledByType[type].length > 0,
    ),
  });

  const hasPermanent = PERIOD_TYPES.some(
    ({ type }) => permanentByType[type].length > 0,
  );

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      toggleQuestActive(id, isActive),
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: questKeys.all });
      toast.success(isActive ? "Quête activée" : "Quête désactivée");
    },
    onError: (err) => {
      const conflict = parseQuestRedundancyError(err);
      if (conflict) {
        setConflictDetails(conflict);
      } else {
        toast.error("Impossible de modifier la quête");
      }
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: number) => duplicateQuest(id),
    onMutate: (id) => {
      setDuplicatingId(id);
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: questKeys.all });
      toast.success("Quête dupliquée", {
        description: `Nouvelle quête créée (désactivée) : ${created.slug}`,
      });
      router.push(`/quests/${created.id}`);
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Impossible de dupliquer la quête",
      );
    },
    onSettled: () => {
      setDuplicatingId(null);
    },
  });

  const importMutation = useMutation({
    mutationFn: (rows: QuestCsvRow[]) => importQuestsFromCsv(rows),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: questKeys.all });
      setImportDialogOpen(false);
      setImportPreview([]);
      setImportErrors([]);
      if (result.errors.length > 0) {
        toast.error(
          `${result.created} quête(s) créée(s), ${result.errors.length} erreur(s)`,
          { description: result.errors[0] },
        );
      } else {
        toast.success(`${result.created} quête(s) importée(s) avec succès`);
      }
    },
    onError: () => {
      toast.error("Erreur d'import", {
        description: "Une erreur est survenue lors de l'import",
      });
    },
  });

  const handleExportTemplate = () => {
    downloadCsv(generateQuestsCsvTemplate(), "quetes_template.csv");
    toast.success("Template CSV téléchargé");
  };

  const handleExportQuests = () => {
    downloadCsv(
      exportQuestsToCsv(quests),
      `quetes_export_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast.success(`${quests.length} quêtes exportées`);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const { rows, errors } = parseQuestsCsv(content);
      setImportPreview(rows);
      setImportErrors(errors);
      setImportDialogOpen(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ---- Sous-composants de rendu ----

  const renderRewards = (quest: QuestWithRelations) => {
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
  };

  const renderParticipation = (stats?: QuestProgressStats) => {
    if (!stats || stats.total === 0) {
      return <span className="text-xs text-muted-foreground">Aucune participation</span>;
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
  };

  const renderQuestCard = (
    quest: QuestWithRelations,
    opts: { past?: boolean; stats?: QuestProgressStats; permanent?: boolean },
  ) => {
    const Icon = questTypeIcons[quest.quest_type];
    return (
      <div
        key={quest.id}
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
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Inactive
                </Badge>
              )}
              {opts.permanent && quest.is_active && (
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

        {renderRewards(quest)}

        <div
          className="flex items-center justify-between pt-1"
          onClick={(e) => e.stopPropagation()}
        >
          {opts.past ? (
            renderParticipation(opts.stats)
          ) : (
            <div className="flex items-center gap-1.5">
              <Switch
                checked={quest.is_active}
                disabled={toggleActiveMutation.isPending}
                onCheckedChange={(checked) =>
                  toggleActiveMutation.mutate({
                    id: quest.id,
                    isActive: checked,
                  })
                }
              />
              <span className="text-[10px] text-muted-foreground">
                {quest.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          )}
          {!opts.past && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Dupliquer la quête"
              disabled={duplicatingId === quest.id}
              onClick={() => duplicateMutation.mutate(quest.id)}
            >
              {duplicatingId === quest.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderFrise = (type: PeriodType) => {
    const periods = friseByType[type];
    const selected = selectedPeriods[type];
    const current = currentIds[type];
    return (
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {periods.map((pid) => {
          const isSel = pid === selected;
          const isCur = pid === current;
          const isPast = pid < current;
          return (
            <button
              key={pid}
              type="button"
              onClick={() => setAnchor((prev) => periodToAnchor(type, pid, prev))}
              title={formatPeriodLabel(type, pid)}
              className={cn(
                "shrink-0 rounded px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                isSel
                  ? "bg-primary text-primary-foreground"
                  : isPast
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
    );
  };

  const renderRow = ({
    type,
    label,
  }: {
    type: PeriodType;
    label: string;
  }) => {
    const selected = selectedPeriods[type];
    const current = currentIds[type];
    const list = scheduledByType[type];
    const isPast = selected < current;
    const isFuture = selected > current;
    const stats = statsByType?.[type];

    return (
      <div key={type} className="rounded-lg border bg-muted/20">
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
              {formatPeriodLabel(type, selected)}
            </span>
            {selected !== current && (
              <button
                type="button"
                onClick={() => setAnchor(new Date())}
                className="text-[10px] text-primary hover:underline whitespace-nowrap"
              >
                Aujourd&apos;hui
              </button>
            )}
          </div>
          <div className="lg:max-w-[60%]">{renderFrise(type)}</div>
        </div>

        <div className="p-3">
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-6 text-center">
              <CalendarClock className="h-5 w-5 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                Aucune quête planifiée sur cette période.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {list.map((quest) =>
                renderQuestCard(quest, {
                  past: isPast,
                  stats: stats?.get(quest.id),
                }),
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Quêtes</h1>
          <p className="text-muted-foreground">
            Visualisez les défis actifs sur chaque période — semaine, mois,
            année.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label
              htmlFor="show-inactive"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Inactives
            </Label>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Wrench className="mr-2 h-4 w-4" />
                Outils
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={handleExportTemplate}>
                <FileDown className="mr-2 h-4 w-4" />
                Télécharger le template CSV
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleExportQuests}>
                <Download className="mr-2 h-4 w-4" />
                Exporter les quêtes
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Importer un CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Link href="/quests/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle quête
            </Button>
          </Link>
        </div>
      </div>

      {hasPermanent && (
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
                  {permanentByType[type].map((quest) =>
                    renderQuestCard(quest, { permanent: true }),
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {PERIOD_TYPES.map((pt) => renderRow(pt))}
      </div>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importer des quêtes</DialogTitle>
            <DialogDescription>
              Vérifiez les quêtes avant de confirmer l&apos;import.
            </DialogDescription>
          </DialogHeader>

          {importErrors.length > 0 && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertCircle className="h-4 w-4" />
                {importErrors.length} erreur(s) de validation
              </div>
              <ul className="text-sm text-destructive space-y-0.5">
                {importErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {importPreview.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {importPreview.length} quête(s) prêtes à être importées
              </div>

              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Objectif</TableHead>
                      <TableHead>Période</TableHead>
                      <TableHead>Bonus XP</TableHead>
                      <TableHead>Bonus CB</TableHead>
                      <TableHead>Périodes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {questTypeLabels[row.quest_type as QuestType] ||
                              row.quest_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {row.quest_type === "amount_spent"
                            ? `${row.target_value} €`
                            : row.quest_type === "cashback_earned"
                            ? `${row.target_value} PdB`
                            : row.target_value}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {periodTypeLabels[row.period_type as PeriodType] ||
                              row.period_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {row.bonus_xp !== "0" ? `+${row.bonus_xp}` : "-"}
                        </TableCell>
                        <TableCell>
                          {row.bonus_cashback !== "0"
                            ? `+${row.bonus_cashback} €`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {row.periods ? (
                            <div className="flex flex-wrap gap-1">
                              {row.periods.split(";").slice(0, 2).map((p) => (
                                <Badge
                                  key={p}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {p.trim()}
                                </Badge>
                              ))}
                              {row.periods.split(";").length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{row.periods.split(";").length - 2}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Toutes
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {importPreview.length === 0 && importErrors.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune donnée valide trouvée dans le fichier CSV.
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImportDialogOpen(false)}
              disabled={importMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              onClick={() => importMutation.mutate(importPreview)}
              disabled={importMutation.isPending || importPreview.length === 0}
            >
              {importMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Importer {importPreview.length} quête(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuestConflictDialog
        open={conflictDetails !== null}
        onOpenChange={(open) => {
          if (!open) setConflictDetails(null);
        }}
        details={conflictDetails}
      />
    </div>
  );
}
