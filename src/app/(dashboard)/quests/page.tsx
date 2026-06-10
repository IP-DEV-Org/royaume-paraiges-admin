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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/layout/page-header";
import {
  Plus,
  Loader2,
  Download,
  Upload,
  FileDown,
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
import { getCurrentPeriodIdentifier } from "@/lib/services/periodService";
import { getPeriodIdentifier } from "@/lib/utils";
import type { QuestWithRelations, PeriodType } from "@/types/database";
import { PERIOD_TYPES } from "./_components/quest-display";
import { periodToAnchor } from "./_components/period-anchor";
import { PeriodSection } from "./_components/period-section";
import { PermanentQuestsSection } from "./_components/permanent-quests-section";
import { ImportCsvDialog } from "./_components/import-csv-dialog";

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

  const handleToggleActive = (id: number, isActive: boolean) =>
    toggleActiveMutation.mutate({ id, isActive });
  const handleDuplicate = (id: number) => duplicateMutation.mutate(id);

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

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quêtes"
        description="Visualisez les défis actifs sur chaque période — semaine, mois, année."
        actions={
          <>
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
              aria-label="Fichier CSV de quêtes à importer"
              onChange={handleFileSelect}
            />
            <Link href="/quests/create">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle quête
              </Button>
            </Link>
          </>
        }
      />

      {hasPermanent && (
        <PermanentQuestsSection
          permanentByType={permanentByType}
          togglePending={toggleActiveMutation.isPending}
          duplicatingId={duplicatingId}
          onToggleActive={handleToggleActive}
          onDuplicate={handleDuplicate}
        />
      )}

      <div className="space-y-4">
        {PERIOD_TYPES.map(({ type, label }) => (
          <PeriodSection
            key={type}
            type={type}
            label={label}
            selectedPeriod={selectedPeriods[type]}
            currentPeriod={currentIds[type]}
            frisePeriods={friseByType[type]}
            quests={scheduledByType[type]}
            stats={statsByType?.[type]}
            onSelectPeriod={(pid) =>
              setAnchor((prev) => periodToAnchor(type, pid, prev))
            }
            onResetToday={() => setAnchor(new Date())}
            togglePending={toggleActiveMutation.isPending}
            duplicatingId={duplicatingId}
            onToggleActive={handleToggleActive}
            onDuplicate={handleDuplicate}
          />
        ))}
      </div>

      <ImportCsvDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        preview={importPreview}
        errors={importErrors}
        importing={importMutation.isPending}
        onConfirm={() => importMutation.mutate(importPreview)}
      />

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
