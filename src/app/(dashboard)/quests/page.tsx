"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Plus,
  Loader2,
  Target,
  Zap,
  MapPin,
  Receipt,
  Archive,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
  FileDown,
  Beer,
  Copy,
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
import { formatCurrency, formatPercentage } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import type { QuestWithRelations, PeriodType, QuestType } from "@/types/database";

function getCurrentPeriodIdentifier(periodType: PeriodType): string {
  const now = new Date();
  const year = now.getFullYear();

  switch (periodType) {
    case "weekly": {
      const firstDayOfYear = new Date(year, 0, 1);
      const pastDaysOfYear = (now.getTime() - firstDayOfYear.getTime()) / 86400000;
      const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
      return `${year}-W${weekNumber.toString().padStart(2, "0")}`;
    }
    case "monthly":
      return `${year}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
    case "yearly":
      return `${year}`;
  }
}

function isQuestForPeriod(quest: QuestWithRelations, periodId: string): boolean {
  const periods = quest.quest_periods || [];
  if (periods.length === 0) return true;
  return periods.some((p) => p.period_identifier === periodId);
}

function getLatestPeriod(quest: QuestWithRelations): string {
  const periods = quest.quest_periods || [];
  if (periods.length === 0) return "";
  return [...periods].map((p) => p.period_identifier).sort().reverse()[0] ?? "";
}

const periodTypeLabels: Record<PeriodType, string> = {
  weekly: "Semaine",
  monthly: "Mois",
  yearly: "Année",
};

const questTypeLabels: Record<QuestType, string> = {
  xp_earned: "Gagner de l'XP",
  amount_spent: "Dépenser de l'argent (déprécié)",
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

export default function QuestsPage() {
  const [quests, setQuests] = useState<QuestWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("weekly");
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [showArchives, setShowArchives] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<QuestCsvRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [archiveStats, setArchiveStats] = useState<Map<number, QuestProgressStats>>(new Map());
  const [loadingArchiveStats, setLoadingArchiveStats] = useState(false);
  const [conflictDetails, setConflictDetails] = useState<QuestRedundancyDetails | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchQuests = useCallback(async () => {
    try {
      const data = await getQuests();
      setQuests(data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les quêtes",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchQuests();
  }, [fetchQuests]);

  // Fetch archive stats when archives are expanded
  useEffect(() => {
    if (!showArchives) return;
    const currentPeriod = getCurrentPeriodIdentifier(selectedPeriod);
    const forType = quests.filter((q) => q.period_type === selectedPeriod);
    const nonCurrent = forType.filter((q) => !isQuestForPeriod(q, currentPeriod));
    const archived = nonCurrent.filter((q) => {
      const latestPeriod = getLatestPeriod(q);
      return latestPeriod <= currentPeriod;
    });
    if (archived.length === 0) return;
    const questIds = archived.map((q) => q.id);
    setLoadingArchiveStats(true);
    getQuestProgressStatsByQuests(questIds)
      .then(setArchiveStats)
      .finally(() => setLoadingArchiveStats(false));
  }, [showArchives, selectedPeriod, quests]);

  const handleToggleActive = async (id: number, isActive: boolean) => {
    try {
      await toggleQuestActive(id, isActive);
      setQuests((prev) =>
        prev.map((q) => (q.id === id ? { ...q, is_active: isActive } : q))
      );
      toast({
        title: isActive ? "Quête activée" : "Quête désactivée",
      });
    } catch (error) {
      const conflict = parseQuestRedundancyError(error);
      if (conflict) {
        setConflictDetails(conflict);
      } else {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de modifier la quête",
        });
      }
    }
  };

  const handleDuplicate = async (id: number) => {
    setDuplicatingId(id);
    try {
      const created = await duplicateQuest(id);
      toast({
        title: "Quête dupliquée",
        description: `Nouvelle quête créée (désactivée) : ${created.slug}`,
      });
      router.push(`/quests/${created.id}`);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description:
          error instanceof Error ? error.message : "Impossible de dupliquer la quête",
      });
    } finally {
      setDuplicatingId(null);
    }
  };

  const handlePeriodTabChange = (value: PeriodType) => {
    setSelectedPeriod(value);
    setShowUpcoming(false);
    setShowArchives(false);
  };

  const downloadCsv = (content: string, filename: string) => {
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportTemplate = () => {
    const csv = generateQuestsCsvTemplate();
    downloadCsv(csv, "quetes_template.csv");
    toast({ title: "Template CSV téléchargé" });
  };

  const handleExportQuests = () => {
    const csv = exportQuestsToCsv(quests);
    downloadCsv(csv, `quetes_export_${new Date().toISOString().slice(0, 10)}.csv`);
    toast({ title: `${quests.length} quêtes exportées` });
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

    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const handleImportConfirm = async () => {
    setImporting(true);
    try {
      const result = await importQuestsFromCsv(importPreview);
      setImportDialogOpen(false);
      setImportPreview([]);
      setImportErrors([]);

      if (result.errors.length > 0) {
        toast({
          variant: "destructive",
          title: `${result.created} quête(s) créée(s), ${result.errors.length} erreur(s)`,
          description: result.errors[0],
        });
      } else {
        toast({ title: `${result.created} quête(s) importée(s) avec succès` });
      }

      // Reload quests
      setLoading(true);
      fetchQuests();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur d'import",
        description: "Une erreur est survenue lors de l'import",
      });
    } finally {
      setImporting(false);
    }
  };

  const currentPeriodId = getCurrentPeriodIdentifier(selectedPeriod);
  const questsForType = quests.filter((q) => q.period_type === selectedPeriod);
  const currentQuests = questsForType.filter((q) => isQuestForPeriod(q, currentPeriodId));
  const nonCurrentQuests = questsForType.filter((q) => !isQuestForPeriod(q, currentPeriodId));

  // Split non-current quests into upcoming (has future periods) vs archived (only past periods)
  const upcomingQuests = nonCurrentQuests.filter((q) => {
    const latestPeriod = getLatestPeriod(q);
    return latestPeriod > currentPeriodId;
  });
  const archivedQuests = nonCurrentQuests.filter((q) => {
    const latestPeriod = getLatestPeriod(q);
    return latestPeriod <= currentPeriodId;
  });

  // Group upcoming quests by their earliest future period, sorted ascending (nearest first)
  const upcomingByPeriod = new Map<string, QuestWithRelations[]>();
  upcomingQuests.forEach((quest) => {
    const periods = (quest.quest_periods || []).map((p) => p.period_identifier).filter((p) => p > currentPeriodId);
    const earliestFuture = periods.sort()[0] || getLatestPeriod(quest);
    if (!upcomingByPeriod.has(earliestFuture)) {
      upcomingByPeriod.set(earliestFuture, []);
    }
    upcomingByPeriod.get(earliestFuture)!.push(quest);
  });
  const sortedUpcomingPeriods = [...upcomingByPeriod.keys()].sort();

  // Group archived quests by their latest period identifier, sorted descending (most recent first)
  const archivesByPeriod = new Map<string, QuestWithRelations[]>();
  archivedQuests.forEach((quest) => {
    const latestPeriod = getLatestPeriod(quest);
    if (!archivesByPeriod.has(latestPeriod)) {
      archivesByPeriod.set(latestPeriod, []);
    }
    archivesByPeriod.get(latestPeriod)!.push(quest);
  });
  const sortedArchivePeriods = [...archivesByPeriod.keys()].sort().reverse();

  const renderQuestRow = (quest: QuestWithRelations) => {
    const Icon = questTypeIcons[quest.quest_type];
    return (
      <TableRow
        key={quest.id}
        className="cursor-pointer"
        onClick={() => router.push(`/quests/${quest.id}`)}
      >
        <TableCell>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
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
        <TableCell>
          <Badge variant="outline">
            {questTypeLabels[quest.quest_type]}
          </Badge>
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
            {quest.quest_type === "consumption_count" && (quest.consumption_type ?? "produits")}
          </span>
        </TableCell>
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
                <span className="text-muted-foreground">
                  Aucune
                </span>
              )}
          </div>
        </TableCell>
        <TableCell>
          {(() => {
            const totalCashback =
              quest.bonus_cashback +
              (quest.coupon_templates?.amount || 0);
            if (totalCashback === 0) {
              return <span className="text-muted-foreground">—</span>;
            }
            let spentCentimes: number | null = null;
            if (quest.quest_type === "amount_spent") {
              // target_value already in centimes
              spentCentimes = quest.target_value;
            } else if (quest.quest_type === "cashback_earned") {
              // 1 PdB ≈ 1 centime de dépense (avec cashback 1% & coefficient 1,0)
              spentCentimes = quest.target_value * 100;
            } else if (quest.quest_type === "xp_earned") {
              // 1€ = 1.66 XP → euros = XP / 1.66, then * 100 for centimes
              spentCentimes = Math.round((quest.target_value / 1.66) * 100);
            }
            if (spentCentimes == null || spentCentimes <= 0) {
              return <span className="text-muted-foreground">—</span>;
            }
            const ratio = (totalCashback / spentCentimes) * 100;
            return (
              <span className="font-medium tabular-nums">
                {ratio.toFixed(1)}%
              </span>
            );
          })()}
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <Switch
              checked={quest.is_active}
              onCheckedChange={(checked) =>
                handleToggleActive(quest.id, checked)
              }
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Dupliquer la quête"
              disabled={duplicatingId === quest.id}
              onClick={() => handleDuplicate(quest.id)}
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
    );
  };

  const renderQuestTable = (questList: QuestWithRelations[]) => (
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
        {questList
          .sort((a, b) => a.display_order - b.display_order)
          .map(renderQuestRow)}
      </TableBody>
    </Table>
  );

  const renderArchivedQuestRow = (quest: QuestWithRelations) => {
    const Icon = questTypeIcons[quest.quest_type];
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
        <TableCell>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
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
        <TableCell>
          <Badge variant="outline">
            {questTypeLabels[quest.quest_type]}
          </Badge>
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
            {quest.quest_type === "consumption_count" && (quest.consumption_type ?? "produits")}
          </span>
        </TableCell>
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
                <span className="text-muted-foreground">
                  Aucune
                </span>
              )}
          </div>
        </TableCell>
        <TableCell>
          {loadingArchiveStats ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : total === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-xs">
                  {successCount} réussie{successCount > 1 ? "s" : ""}
                </Badge>
                <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs">
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
  };

  const renderArchivedQuestTable = (questList: QuestWithRelations[]) => (
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
        {questList
          .sort((a, b) => a.display_order - b.display_order)
          .map(renderArchivedQuestRow)}
      </TableBody>
    </Table>
  );

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quêtes</h1>
          <p className="text-muted-foreground">
            Configurez les défis périodiques pour les utilisateurs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportTemplate}>
            <FileDown className="mr-2 h-4 w-4" />
            Template CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportQuests}>
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Importer CSV
          </Button>
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
            Définissez les objectifs et récompenses pour chaque période
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={selectedPeriod}
            onValueChange={(v) => handlePeriodTabChange(v as PeriodType)}
          >
            <TabsList className="mb-4">
              <TabsTrigger value="weekly" className="text-xs sm:text-sm">Hebdo</TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs sm:text-sm">Mensuel</TabsTrigger>
              <TabsTrigger value="yearly" className="text-xs sm:text-sm">Annuel</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedPeriod}>
              {/* Current period section */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {periodTypeLabels[selectedPeriod]} en cours
                  </h3>
                  <Badge>{currentPeriodId}</Badge>
                </div>

                {currentQuests.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground border rounded-lg">
                    Aucune quête configurée pour la période en cours
                  </div>
                ) : (
                  renderQuestTable(currentQuests)
                )}
              </div>

              {/* Upcoming section */}
              {upcomingQuests.length > 0 && (
                <div className="border-t pt-4">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowUpcoming(!showUpcoming)}
                  >
                    {showUpcoming ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <CalendarClock className="h-4 w-4" />
                    Quêtes à venir
                    <Badge variant="secondary" className="ml-1">
                      {upcomingQuests.length}
                    </Badge>
                  </Button>

                  {showUpcoming && (
                    <div className="mt-4 space-y-6">
                      {sortedUpcomingPeriods.map((period) => {
                        const periodQuests = upcomingByPeriod.get(period)!;
                        return (
                          <div key={period}>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">{period}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {periodQuests.length} quête{periodQuests.length > 1 ? "s" : ""}
                              </span>
                            </div>
                            {renderQuestTable(periodQuests)}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Archives section */}
              {archivedQuests.length > 0 && (
                <div className="border-t pt-4">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowArchives(!showArchives)}
                  >
                    {showArchives ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <Archive className="h-4 w-4" />
                    Archives
                    <Badge variant="secondary" className="ml-1">
                      {archivedQuests.length}
                    </Badge>
                  </Button>

                  {showArchives && (
                    <div className="mt-4 space-y-6">
                      {sortedArchivePeriods.map((period) => {
                        const periodQuests = archivesByPeriod.get(period)!;
                        return (
                          <div key={period}>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">{period}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {periodQuests.length} quête{periodQuests.length > 1 ? "s" : ""}
                              </span>
                            </div>
                            {renderArchivedQuestTable(periodQuests)}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importer des quêtes</DialogTitle>
            <DialogDescription>
              Vérifiez les quêtes avant de confirmer l&apos;import
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
                            {questTypeLabels[row.quest_type as QuestType] || row.quest_type}
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
                            {periodTypeLabels[row.period_type as PeriodType] || row.period_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.bonus_xp !== "0" ? `+${row.bonus_xp}` : "-"}</TableCell>
                        <TableCell>
                          {row.bonus_cashback !== "0" ? `+${row.bonus_cashback} €` : "-"}
                        </TableCell>
                        <TableCell>
                          {row.periods ? (
                            <div className="flex flex-wrap gap-1">
                              {row.periods.split(";").slice(0, 2).map((p) => (
                                <Badge key={p} variant="outline" className="text-xs">
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
                            <span className="text-xs text-muted-foreground italic">Toutes</span>
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
              disabled={importing}
            >
              Annuler
            </Button>
            <Button
              onClick={handleImportConfirm}
              disabled={importing || importPreview.length === 0}
            >
              {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
