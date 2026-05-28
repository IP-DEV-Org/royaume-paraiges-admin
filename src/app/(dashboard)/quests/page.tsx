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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
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
} from "lucide-react";
import {
  getQuests,
  toggleQuestActive,
  duplicateQuest,
  generateQuestsCsvTemplate,
  exportQuestsToCsv,
  parseQuestsCsv,
  importQuestsFromCsv,
  getQuestProgressStatsByQuests,
  type QuestCsvRow,
  type QuestProgressStats,
} from "@/lib/services/questService";
import {
  parseQuestRedundancyError,
  type QuestRedundancyDetails,
} from "@/lib/supabase/errorParser";
import { QuestConflictDialog } from "@/components/quest-conflict-dialog";
import { questKeys } from "@/lib/queries/keys";
import { cn, formatCurrency, formatPercentage } from "@/lib/utils";
import type {
  QuestWithRelations,
  PeriodType,
  QuestType,
} from "@/types/database";

function getCurrentPeriodIdentifier(periodType: PeriodType): string {
  const now = new Date();
  const year = now.getFullYear();

  switch (periodType) {
    case "weekly": {
      const firstDayOfYear = new Date(year, 0, 1);
      const pastDaysOfYear =
        (now.getTime() - firstDayOfYear.getTime()) / 86400000;
      const weekNumber = Math.ceil(
        (pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7,
      );
      return `${year}-W${weekNumber.toString().padStart(2, "0")}`;
    }
    case "monthly":
      return `${year}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
    case "yearly":
      return `${year}`;
  }
}

function isQuestForPeriod(
  quest: QuestWithRelations,
  periodId: string,
): boolean {
  const periods = quest.quest_periods || [];
  if (periods.length === 0) return true;
  return periods.some((p) => p.period_identifier === periodId);
}

function getLatestPeriod(quest: QuestWithRelations): string {
  const periods = quest.quest_periods || [];
  if (periods.length === 0) return "";
  return [...periods].map((p) => p.period_identifier).sort().reverse()[0] ?? "";
}

function getEarliestFuturePeriod(
  quest: QuestWithRelations,
  currentPeriodId: string,
): string {
  const periods = (quest.quest_periods || [])
    .map((p) => p.period_identifier)
    .filter((p) => p > currentPeriodId);
  return periods.sort()[0] || getLatestPeriod(quest);
}

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

type ViewMode = "current" | "upcoming" | "archives";

const viewModeLabels: Record<ViewMode, string> = {
  current: "Actuelles",
  upcoming: "À venir",
  archives: "Archives",
};

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

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("weekly");
  const [viewMode, setViewMode] = useState<ViewMode>("current");
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

  const currentPeriodId = getCurrentPeriodIdentifier(selectedPeriod);

  const { currentQuests, upcomingByPeriod, archivesByPeriod } = useMemo(() => {
    const forType = quests.filter((q) => q.period_type === selectedPeriod);
    const current = forType.filter((q) =>
      isQuestForPeriod(q, currentPeriodId),
    );
    const nonCurrent = forType.filter(
      (q) => !isQuestForPeriod(q, currentPeriodId),
    );

    const upcoming = nonCurrent.filter(
      (q) => getLatestPeriod(q) > currentPeriodId,
    );
    const archived = nonCurrent.filter(
      (q) => getLatestPeriod(q) <= currentPeriodId,
    );

    const upcomingMap = new Map<string, QuestWithRelations[]>();
    for (const quest of upcoming) {
      const key = getEarliestFuturePeriod(quest, currentPeriodId);
      if (!upcomingMap.has(key)) upcomingMap.set(key, []);
      upcomingMap.get(key)!.push(quest);
    }

    const archiveMap = new Map<string, QuestWithRelations[]>();
    for (const quest of archived) {
      const key = getLatestPeriod(quest);
      if (!archiveMap.has(key)) archiveMap.set(key, []);
      archiveMap.get(key)!.push(quest);
    }

    return {
      currentQuests: current,
      upcomingByPeriod: upcomingMap,
      archivesByPeriod: archiveMap,
    };
  }, [quests, selectedPeriod, currentPeriodId]);

  const upcomingTotal = useMemo(
    () =>
      [...upcomingByPeriod.values()].reduce((sum, arr) => sum + arr.length, 0),
    [upcomingByPeriod],
  );
  const archivedTotal = useMemo(
    () =>
      [...archivesByPeriod.values()].reduce((sum, arr) => sum + arr.length, 0),
    [archivesByPeriod],
  );

  const sortedUpcomingPeriods = useMemo(
    () => [...upcomingByPeriod.keys()].sort(),
    [upcomingByPeriod],
  );
  const sortedArchivePeriods = useMemo(
    () => [...archivesByPeriod.keys()].sort().reverse(),
    [archivesByPeriod],
  );

  const archivedQuestIds = useMemo(
    () => [...archivesByPeriod.values()].flat().map((q) => q.id),
    [archivesByPeriod],
  );

  const { data: archiveStats = new Map<number, QuestProgressStats>() } =
    useQuery({
      queryKey: [
        ...questKeys.all,
        "archive-stats",
        selectedPeriod,
        archivedQuestIds.join(","),
      ],
      queryFn: () => getQuestProgressStatsByQuests(archivedQuestIds),
      enabled: viewMode === "archives" && archivedQuestIds.length > 0,
    });

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

  const handlePeriodTabChange = (value: PeriodType) => {
    setSelectedPeriod(value);
    setViewMode("current");
  };

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

  const renderTypeAndObjective = (quest: QuestWithRelations) => (
    <>
      <TableCell>
        <Badge variant="outline">{questTypeLabels[quest.quest_type]}</Badge>
      </TableCell>
      <TableCell>
        <span className="font-medium">
          {quest.quest_type === "amount_spent"
            ? formatCurrency(quest.target_value)
            : quest.target_value}
        </span>
        <span className="text-muted-foreground ml-1">
          {quest.quest_type === "xp_earned" && "XP"}
          {quest.quest_type === "cashback_earned" && "PdB"}
          {quest.quest_type === "establishments_visited" && "établissements"}
          {quest.quest_type === "orders_count" && "commandes"}
          {quest.quest_type === "quest_completed" && "sous-périodes"}
          {quest.quest_type === "consumption_count" &&
            (quest.consumption_type ?? "produits")}
        </span>
      </TableCell>
    </>
  );

  const renderRewards = (quest: QuestWithRelations) => (
    <TableCell>
      <div className="space-y-1">
        {quest.coupon_templates && (
          <Badge variant="secondary" className="mr-1">
            {quest.coupon_templates.amount
              ? formatCurrency(quest.coupon_templates.amount)
              : quest.coupon_templates.percentage
              ? formatPercentage(quest.coupon_templates.percentage)
              : quest.coupon_templates.name}
          </Badge>
        )}
        {quest.badge_types && (
          <Badge variant="secondary" className="mr-1">
            {quest.badge_types.name}
          </Badge>
        )}
        {quest.bonus_xp > 0 && (
          <Badge variant="outline" className="mr-1">
            +{quest.bonus_xp} XP
          </Badge>
        )}
        {quest.bonus_cashback > 0 && (
          <Badge variant="outline">
            +{formatCurrency(quest.bonus_cashback)}
          </Badge>
        )}
        {!quest.coupon_templates &&
          !quest.badge_types &&
          quest.bonus_xp === 0 &&
          quest.bonus_cashback === 0 && (
            <span className="text-muted-foreground">Aucune</span>
          )}
      </div>
    </TableCell>
  );

  const renderNameCell = (quest: QuestWithRelations, dim: boolean) => {
    const Icon = questTypeIcons[quest.quest_type];
    return (
      <TableCell>
        <div className="flex items-center gap-2">
          <Icon
            className={cn("h-5 w-5", dim ? "text-muted-foreground" : "text-primary")}
          />
          <div>
            <p className="font-medium">{quest.name}</p>
            {quest.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {quest.description}
              </p>
            )}
          </div>
        </div>
      </TableCell>
    );
  };

  const renderActiveTable = (questList: QuestWithRelations[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Quête</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Objectif</TableHead>
          <TableHead>Périodes</TableHead>
          <TableHead>Récompenses</TableHead>
          <TableHead>Ratio CB</TableHead>
          <TableHead>Active</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...questList]
          .sort((a, b) => a.display_order - b.display_order)
          .map((quest) => (
            <TableRow
              key={quest.id}
              className="cursor-pointer"
              onClick={() => router.push(`/quests/${quest.id}`)}
            >
              {renderNameCell(quest, false)}
              {renderTypeAndObjective(quest)}
              <TableCell>
                {quest.quest_periods && quest.quest_periods.length > 0 ? (
                  <div className="flex flex-wrap gap-1 max-w-[150px]">
                    {quest.quest_periods.slice(0, 3).map((p) => (
                      <Badge key={p.id} variant="outline" className="text-xs">
                        {p.period_identifier}
                      </Badge>
                    ))}
                    {quest.quest_periods.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{quest.quest_periods.length - 3}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">
                    Toutes
                  </span>
                )}
              </TableCell>
              {renderRewards(quest)}
              <TableCell>{renderRatioCb(quest)}</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={quest.is_active}
                    onCheckedChange={(checked) =>
                      toggleActiveMutation.mutate({
                        id: quest.id,
                        isActive: checked,
                      })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Dupliquer la quête"
                    disabled={duplicatingId === quest.id}
                    onClick={() => duplicateMutation.mutate(quest.id)}
                  >
                    {duplicatingId === quest.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );

  const renderArchivedTable = (questList: QuestWithRelations[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Quête</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Objectif</TableHead>
          <TableHead>Récompenses</TableHead>
          <TableHead>Participation</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...questList]
          .sort((a, b) => a.display_order - b.display_order)
          .map((quest) => {
            const stats = archiveStats.get(quest.id);
            const successCount = stats ? stats.completed + stats.rewarded : 0;
            const expiredCount = stats?.expired ?? 0;
            const total = stats?.total ?? 0;
            return (
              <TableRow
                key={quest.id}
                className="cursor-pointer"
                onClick={() => router.push(`/quests/${quest.id}`)}
              >
                {renderNameCell(quest, true)}
                {renderTypeAndObjective(quest)}
                {renderRewards(quest)}
                <TableCell>
                  {total === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className="bg-emerald-100 text-emerald-800 text-xs"
                        >
                          {successCount} réussie{successCount > 1 ? "s" : ""}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="bg-red-100 text-red-800 text-xs"
                        >
                          {expiredCount} expirée{expiredCount > 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {total} participant{total > 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
      </TableBody>
    </Table>
  );

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
            Configurez les défis périodiques pour les utilisateurs.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
              <DropdownMenuItem
                onSelect={() => fileInputRef.current?.click()}
              >
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

      <Card>
        <CardHeader>
          <CardTitle>Liste des quêtes</CardTitle>
          <CardDescription>
            Définissez les objectifs et récompenses pour chaque période.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs
            value={selectedPeriod}
            onValueChange={(v) => handlePeriodTabChange(v as PeriodType)}
          >
            <TabsList>
              <TabsTrigger value="weekly" className="text-xs sm:text-sm">
                Hebdo
              </TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs sm:text-sm">
                Mensuel
              </TabsTrigger>
              <TabsTrigger value="yearly" className="text-xs sm:text-sm">
                Annuel
              </TabsTrigger>
            </TabsList>

            <TabsContent value={selectedPeriod} className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div
                  role="radiogroup"
                  className="inline-flex rounded-md border bg-muted p-1"
                >
                  {(
                    [
                      { mode: "current" as const, count: currentQuests.length },
                      { mode: "upcoming" as const, count: upcomingTotal },
                      { mode: "archives" as const, count: archivedTotal },
                    ]
                  ).map(({ mode, count }) => {
                    const active = viewMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setViewMode(mode)}
                        className={cn(
                          "rounded px-3 py-1 text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5",
                          active
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {viewModeLabels[mode]}
                        <span
                          className={cn(
                            "rounded-full px-1.5 text-[10px]",
                            active
                              ? "bg-muted text-muted-foreground"
                              : "bg-background/80",
                          )}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {viewMode === "current" && (
                  <Badge variant="secondary">{currentPeriodId}</Badge>
                )}
              </div>

              {viewMode === "current" &&
                (currentQuests.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground border rounded-lg">
                    Aucune quête configurée pour la période en cours.
                  </div>
                ) : (
                  renderActiveTable(currentQuests)
                ))}

              {viewMode === "upcoming" &&
                (upcomingTotal === 0 ? (
                  <div className="py-8 text-center text-muted-foreground border rounded-lg">
                    Aucune quête planifiée pour une période future.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {sortedUpcomingPeriods.map((period) => {
                      const periodQuests = upcomingByPeriod.get(period)!;
                      return (
                        <div key={period}>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{period}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {periodQuests.length} quête
                              {periodQuests.length > 1 ? "s" : ""}
                            </span>
                          </div>
                          {renderActiveTable(periodQuests)}
                        </div>
                      );
                    })}
                  </div>
                ))}

              {viewMode === "archives" &&
                (archivedTotal === 0 ? (
                  <div className="py-8 text-center text-muted-foreground border rounded-lg">
                    Aucune quête archivée pour ce type de période.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {sortedArchivePeriods.map((period) => {
                      const periodQuests = archivesByPeriod.get(period)!;
                      return (
                        <div key={period}>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{period}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {periodQuests.length} quête
                              {periodQuests.length > 1 ? "s" : ""}
                            </span>
                          </div>
                          {renderArchivedTable(periodQuests)}
                        </div>
                      );
                    })}
                  </div>
                ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

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
              disabled={
                importMutation.isPending || importPreview.length === 0
              }
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

function renderRatioCb(quest: QuestWithRelations) {
  const totalCashback =
    quest.bonus_cashback + (quest.coupon_templates?.amount || 0);
  if (totalCashback === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  let spentCentimes: number | null = null;
  if (quest.quest_type === "amount_spent") {
    spentCentimes = quest.target_value;
  } else if (quest.quest_type === "cashback_earned") {
    spentCentimes = quest.target_value * 100;
  } else if (quest.quest_type === "xp_earned") {
    spentCentimes = Math.round((quest.target_value / 1.66) * 100);
  }
  if (spentCentimes == null || spentCentimes <= 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  const ratio = (totalCashback / spentCentimes) * 100;
  return <span className="font-medium tabular-nums">{ratio.toFixed(1)}%</span>;
}
