"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Download,
  Loader2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { analyticsKeys } from "@/lib/queries/keys";
import {
  getXpDistribution,
  getXpWeeklyTotals,
  getXpWeeklyTotalsForUsers,
} from "@/lib/services/analyticsService";
import {
  MAX_CHART_SERIES,
  SERIES_PALETTE,
  XpProjectionChart,
  type XpProjectionSeries,
} from "./_components/xp-projection-chart";
import { PageHeader } from "@/components/layout/page-header";
import {
  getPeriodBounds,
  PeriodRange,
  todayUtcISO,
  type PeriodMode,
} from "@/components/period-range";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";

/** Tous les jours calendaires (YYYY-MM-DD) de [startDate, endDate] inclus. */
function enumerateDays(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const d = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

/** Tous les mois (YYYY-MM) de [startDate, endDate] inclus. */
function enumerateMonths(startDate: string, endDate: string): string[] {
  const months: string[] = [];
  const d = new Date(`${startDate.slice(0, 7)}-01T00:00:00Z`);
  const endMonth = endDate.slice(0, 7);
  while (d.toISOString().slice(0, 7) <= endMonth) {
    months.push(d.toISOString().slice(0, 7));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return months;
}

/** En-tête de colonne : jour (YYYY-MM-DD) ou mois (YYYY-MM). */
function formatColHeader(col: string): string {
  if (col.length === 7) {
    return new Date(`${col}-01T00:00:00Z`).toLocaleDateString("fr-FR", {
      month: "short",
      year: "numeric",
    });
  }
  return new Date(`${col}T00:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

const formatXp = (xp: number) => xp.toLocaleString("fr-FR");

/** Échappe une valeur CSV (séparateur ; — quotes si nécessaire). */
function csvEscape(value: string): string {
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Ligne affichable : valeurs indexées par colonne (jour ou mois agrégé). */
interface DisplayRow {
  customer_id: string;
  pseudo: string;
  total_xp: number;
  values: Record<string, number>;
}

/**
 * CSV des données affichées : 1 ligne par utilisateur.
 * Colonnes : Pseudo ; Total XP ; une colonne par jour (ou mois en vue année).
 */
function buildXpCsv(rows: DisplayRow[], columns: string[]): string {
  const header = ["Pseudo", "Total XP", ...columns].join(";");
  const lines = rows.map((r) =>
    [
      csvEscape(r.pseudo),
      String(r.total_xp),
      ...columns.map((c) => String(r.values[c] ?? 0)),
    ].join(";")
  );
  return [header, ...lines].join("\n");
}

function downloadCsv(content: string, filename: string) {
  const BOM = "﻿";
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const CHECK_COL_W = 44;
const FIRST_COL_W = 180;
const TOTAL_COL_W = 100;
const COL_W = 92;

// ── Tri client (même cycle que <DataTable> : asc → desc → aucun) ─────────────

/** Clé de tri : "pseudo", "total" ou une colonne jour/mois (YYYY-MM-DD / YYYY-MM). */
type SortState = { key: string; direction: "asc" | "desc" } | null;

function SortChevron({
  sorted,
  direction,
}: {
  sorted: boolean;
  direction?: "asc" | "desc";
}) {
  if (!sorted) {
    return <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />;
  }
  return direction === "asc" ? (
    <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
  ) : (
    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
  );
}

/** Utilisateur coché pour le graphique — le slot couleur suit l'utilisateur. */
interface SelectedUser {
  id: string;
  pseudo: string;
  colorIdx: number;
}

export default function XpDistributionPage() {
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [date, setDate] = useState<string>(() => todayUtcISO());

  const { startDate, endDate } = useMemo(
    () => getPeriodBounds(periodMode, date),
    [periodMode, date]
  );

  const distributionQuery = useQuery({
    queryKey: analyticsKeys.xpDistribution({ startDate, endDate }),
    queryFn: () => getXpDistribution(startDate, endDate),
    placeholderData: keepPreviousData,
  });

  const rows = useMemo(
    () => distributionQuery.data ?? [],
    [distributionQuery.data]
  );
  // Colonnes : une par jour, sauf en vue année (une par mois, valeurs agrégées).
  const columns = useMemo(
    () =>
      periodMode === "year"
        ? enumerateMonths(startDate, endDate)
        : enumerateDays(startDate, endDate),
    [periodMode, startDate, endDate]
  );
  const displayRows = useMemo<DisplayRow[]>(() => {
    if (periodMode !== "year") {
      return rows.map((r) => ({ ...r, values: r.xp_by_day }));
    }
    return rows.map((r) => {
      const values: Record<string, number> = {};
      for (const [day, xp] of Object.entries(r.xp_by_day)) {
        const month = day.slice(0, 7);
        values[month] = (values[month] || 0) + xp;
      }
      return { customer_id: r.customer_id, pseudo: r.pseudo, total_xp: r.total_xp, values };
    });
  }, [rows, periodMode]);
  const isLoading = distributionQuery.isLoading;

  // Tri : par défaut, ordre du service (total XP décroissant).
  const [sort, setSort] = useState<SortState>(null);

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  const sortedRows = useMemo(() => {
    if (!sort) return displayRows;
    const dir = sort.direction === "asc" ? 1 : -1;
    if (sort.key === "pseudo") {
      return [...displayRows].sort(
        (a, b) =>
          dir * a.pseudo.localeCompare(b.pseudo, "fr", { sensitivity: "base" })
      );
    }
    const value = (r: DisplayRow) =>
      sort.key === "total" ? r.total_xp : (r.values[sort.key] ?? 0);
    return [...displayRows].sort((a, b) => dir * (value(a) - value(b)));
  }, [displayRows, sort]);

  const ariaSort = (key: string): "ascending" | "descending" | "none" =>
    sort?.key === key
      ? sort.direction === "asc"
        ? "ascending"
        : "descending"
      : "none";

  // Série hebdo de l'année en cours pour le graphique de projection —
  // indépendante de la période affichée dans le tableau.
  const chartYear = new Date().getFullYear();
  const weeklyQuery = useQuery({
    queryKey: analyticsKeys.xpYearlySeries(chartYear),
    queryFn: () =>
      getXpWeeklyTotals(`${chartYear}-01-01`, `${chartYear}-12-31`),
    staleTime: 5 * 60 * 1000,
  });

  // Utilisateurs cochés dans le tableau → une courbe chacun sur le graphique.
  // Le slot couleur est attribué au cochage et conservé quand un autre
  // utilisateur est décoché (la couleur suit l'utilisateur, pas le rang).
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const selectedIds = useMemo(
    () => selectedUsers.map((u) => u.id),
    [selectedUsers]
  );

  const toggleUser = (row: { customer_id: string; pseudo: string }) => {
    const isSelected = selectedUsers.some((u) => u.id === row.customer_id);
    if (!isSelected && selectedUsers.length >= MAX_CHART_SERIES) {
      toast.info(
        `Maximum ${MAX_CHART_SERIES} utilisateurs affichables sur le graphique`
      );
      return;
    }
    setSelectedUsers((prev) => {
      if (prev.some((u) => u.id === row.customer_id)) {
        return prev.filter((u) => u.id !== row.customer_id);
      }
      const used = new Set(prev.map((u) => u.colorIdx));
      let colorIdx = 0;
      while (used.has(colorIdx)) colorIdx++;
      return [...prev, { id: row.customer_id, pseudo: row.pseudo, colorIdx }];
    });
  };

  const userSeriesQuery = useQuery({
    queryKey: analyticsKeys.xpYearlySeriesUsers(chartYear, selectedIds),
    queryFn: () =>
      getXpWeeklyTotalsForUsers(
        `${chartYear}-01-01`,
        `${chartYear}-12-31`,
        selectedIds
      ),
    enabled: selectedIds.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });

  // Sans sélection : courbe globale. Avec sélection : une courbe par coché.
  const chartSeries = useMemo((): XpProjectionSeries[] => {
    if (selectedUsers.length === 0) {
      return [
        {
          key: "all",
          label: "Tous les utilisateurs",
          color: SERIES_PALETTE[0],
          weekly: weeklyQuery.data ?? [],
        },
      ];
    }
    const byId = new Map(
      (userSeriesQuery.data ?? []).map((s) => [s.customer_id, s.weekly])
    );
    return selectedUsers.map((u) => ({
      key: u.id,
      label: u.pseudo,
      color: SERIES_PALETTE[u.colorIdx] ?? SERIES_PALETTE[0],
      weekly: byId.get(u.id) ?? [],
    }));
  }, [selectedUsers, weeklyQuery.data, userSeriesQuery.data]);

  const chartLoading =
    selectedUsers.length === 0
      ? weeklyQuery.isLoading
      : userSeriesQuery.isLoading;

  const handleExportCsv = () => {
    downloadCsv(buildXpCsv(sortedRows, columns), `xp_${startDate}_${endDate}.csv`);
    toast.success("Export CSV téléchargé");
  };

  // Export d'une année complète : fetch dédié (hors query affichée).
  // Colonnes = uniquement les jours avec au moins un gain (pattern /analytics).
  const exportableYears = Array.from(
    { length: chartYear - 2025 + 1 },
    (_, i) => String(chartYear - i)
  );
  const [exportYearOpen, setExportYearOpen] = useState(false);
  const [exportYear, setExportYear] = useState(String(chartYear));
  const [exportingYear, setExportingYear] = useState(false);

  const handleExportYear = async () => {
    setExportingYear(true);
    try {
      const yearRows = await getXpDistribution(
        `${exportYear}-01-01`,
        `${exportYear}-12-31`
      );
      if (yearRows.length === 0) {
        toast.info(`Aucun gain d'XP sur l'année ${exportYear}`);
        return;
      }
      const yearDays = Array.from(
        new Set(yearRows.flatMap((r) => Object.keys(r.xp_by_day)))
      ).sort();
      downloadCsv(
        buildXpCsv(
          yearRows.map((r) => ({ ...r, values: r.xp_by_day })),
          yearDays
        ),
        `xp_${exportYear}.csv`
      );
      toast.success(`Export ${exportYear} téléchargé`);
      setExportYearOpen(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Erreur lors de l'export de l'année"
      );
    } finally {
      setExportingYear(false);
    }
  };

  const tableWidth =
    CHECK_COL_W + FIRST_COL_W + TOTAL_COL_W + columns.length * COL_W;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Répartition XP"
        description="Gains d'XP par utilisateur et par jour (jour calendaire Europe/Paris, comptes test exclus)."
      />

      {/* Filtres */}
      <div className="flex flex-wrap items-end gap-3">
        <PeriodRange
          mode={periodMode}
          date={date}
          onModeChange={setPeriodMode}
          onDateChange={setDate}
          modes={["day", "week", "month", "year"]}
        />
        <div className="ml-auto flex flex-wrap items-end gap-3">
          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={isLoading || rows.length === 0}
            title="Exporte en CSV les données affichées : pseudo, total XP, puis une colonne par jour"
          >
            <Download className="mr-2 h-4 w-4" />
            Exporter CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => setExportYearOpen(true)}
            title="Exporte en CSV les gains d'XP d'une année complète"
          >
            <Download className="mr-2 h-4 w-4" />
            Exporter année
          </Button>
        </div>
      </div>

      {/* Projection annuelle du cumul d'XP — globale ou par utilisateur coché */}
      <XpProjectionChart
        series={chartSeries}
        year={chartYear}
        loading={chartLoading}
      />

      {/* Tableau pivot : lignes = utilisateurs, colonnes = jours */}
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table
            className="text-sm"
            style={{ width: tableWidth, tableLayout: "fixed" }}
          >
            <colgroup>
              <col style={{ width: CHECK_COL_W }} />
              <col style={{ width: FIRST_COL_W }} />
              <col style={{ width: TOTAL_COL_W }} />
              {columns.map((c) => (
                <col key={c} style={{ width: COL_W }} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b bg-muted/40">
                <th
                  className="sticky left-0 z-10 bg-background px-3 py-2"
                  title="Cocher pour afficher la courbe de l'utilisateur sur le graphique"
                >
                  <span className="sr-only">Afficher sur le graphique</span>
                </th>
                <th
                  className="sticky z-10 bg-background px-3 py-2 text-left font-medium"
                  style={{ left: CHECK_COL_W }}
                  aria-sort={ariaSort("pseudo")}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort("pseudo")}
                    className="-ml-1 flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground"
                  >
                    Pseudo
                    <SortChevron
                      sorted={sort?.key === "pseudo"}
                      direction={sort?.direction}
                    />
                  </button>
                </th>
                <th
                  className="px-3 py-2 text-right font-medium"
                  aria-sort={ariaSort("total")}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort("total")}
                    className="ml-auto flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground"
                  >
                    Total XP
                    <SortChevron
                      sorted={sort?.key === "total"}
                      direction={sort?.direction}
                    />
                  </button>
                </th>
                {columns.map((c) => (
                  <th
                    key={c}
                    className="border-l border-border/30 px-3 py-2 text-right font-medium text-muted-foreground"
                    aria-sort={ariaSort(c)}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(c)}
                      className="ml-auto flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground"
                    >
                      {formatColHeader(c)}
                      <SortChevron
                        sorted={sort?.key === c}
                        direction={sort?.direction}
                      />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="sticky left-0 z-10 bg-background px-3 py-2">
                      <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                    </td>
                    <td
                      className="sticky z-10 bg-background px-3 py-2"
                      style={{ left: CHECK_COL_W }}
                    >
                      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                    </td>
                    <td colSpan={1 + columns.length} className="px-3 py-2">
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    </td>
                  </tr>
                ))}

              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={3 + columns.length}>
                    <EmptyState
                      icon={Zap}
                      title="Aucun gain d'XP sur cette période"
                      description="Change de période avec le sélecteur ci-dessus."
                    />
                  </td>
                </tr>
              )}

              {!isLoading &&
                sortedRows.map((r) => {
                  const selected = selectedUsers.find(
                    (u) => u.id === r.customer_id
                  );
                  return (
                  <tr key={r.customer_id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-background px-3 py-2">
                      <Checkbox
                        checked={!!selected}
                        onCheckedChange={() => toggleUser(r)}
                        aria-label={`Afficher la courbe de ${r.pseudo} sur le graphique`}
                      />
                    </td>
                    <td
                      className="sticky z-10 truncate bg-background px-3 py-2 font-medium"
                      style={{ left: CHECK_COL_W }}
                      title={r.pseudo}
                    >
                      {selected && (
                        <span
                          className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                          style={{
                            backgroundColor:
                              SERIES_PALETTE[selected.colorIdx] ??
                              SERIES_PALETTE[0],
                          }}
                          aria-hidden="true"
                        />
                      )}
                      {r.pseudo}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {formatXp(r.total_xp)}
                    </td>
                    {columns.map((c) => {
                      const xp = r.values[c];
                      return (
                        <td
                          key={c}
                          className="border-l border-border/30 px-3 py-2 text-right tabular-nums"
                        >
                          {xp ? (
                            formatXp(xp)
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {!isLoading && rows.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {rows.length} utilisateur{rows.length > 1 ? "s" : ""} avec au moins un
          gain d&apos;XP sur la période.
        </p>
      )}

      {/* Export d'une année complète */}
      <Dialog
        open={exportYearOpen}
        onOpenChange={(open) => {
          if (!exportingYear) setExportYearOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Exporter une année</DialogTitle>
            <DialogDescription>
              Exporte en CSV les gains d&apos;XP de tous les utilisateurs sur
              l&apos;année sélectionnée : pseudo, total XP, puis une colonne par
              jour avec au moins un gain.
            </DialogDescription>
          </DialogHeader>
          <Select value={exportYear} onValueChange={setExportYear}>
            <SelectTrigger aria-label="Année à exporter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {exportableYears.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExportYearOpen(false)}
              disabled={exportingYear}
            >
              Annuler
            </Button>
            <Button onClick={handleExportYear} disabled={exportingYear}>
              {exportingYear ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Exporter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
