"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { analyticsKeys } from "@/lib/queries/keys";
import {
  getAnalyticsTimeline,
  type DrilldownFilters,
  type DrilldownMetric,
  type TimelineRow,
} from "@/lib/services/analyticsService";
import { getEstablishments } from "@/lib/services/contentService";
import { DrilldownModal } from "@/components/analytics-drilldown-modal";
import {
  EstablishmentMultiFilter,
  type EstablishmentOption,
} from "@/components/analytics/establishment-multi-filter";
import {
  getPeriodBounds,
  TimelinePeriodRange,
  todayUtcISO,
  type PeriodMode,
} from "@/components/analytics/timeline-period-range";
import {
  TimelineTable,
  type TimelineCellMetric,
} from "@/components/analytics/timeline-table";
import { Checkbox } from "@/components/ui/checkbox";

/** Jour calendaire suivant (YYYY-MM-DD) — borne de fin exclusive pour le drilldown. */
function nextDay(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatDateFr(fiscalDate: string): string {
  return new Date(`${fiscalDate}T00:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export default function AnalyticsPage() {
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [date, setDate] = useState<string>(() => todayUtcISO());
  const [selectedEstablishments, setSelectedEstablishments] = useState<number[]>([]);
  const [estFilterOpen, setEstFilterOpen] = useState(false);
  // Comparaison Cashpad : calcul lourd (agrégation snapshot 454 MB) → désactivé
  // par défaut, activable à la demande via la checkbox.
  const [showCashpad, setShowCashpad] = useState(false);

  // Hauteur de la barre de filtres → offset auquel figer l'entête du tableau.
  const filterBarRef = useRef<HTMLDivElement>(null);
  const [stickyTop, setStickyTop] = useState(0);
  useEffect(() => {
    const el = filterBarRef.current;
    if (!el) return;
    const measure = () => {
      // `top` sticky (négatif via -top-6) à ajouter pour caler sous le bas de la barre.
      const topPx = parseFloat(getComputedStyle(el).top) || 0;
      setStickyTop(Math.max(0, el.offsetHeight + topPx));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Drilldown
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownMetric, setDrilldownMetric] = useState<DrilldownMetric | null>(null);
  const [drilldownTitle, setDrilldownTitle] = useState("");
  const [drilldownFilters, setDrilldownFilters] = useState<DrilldownFilters>({
    startDate: "",
    endDate: "",
  });

  const { startDate, endDate } = useMemo(
    () => getPeriodBounds(periodMode, date),
    [periodMode, date]
  );

  const establishmentsQuery = useQuery({
    queryKey: ["establishments", "options"],
    queryFn: async (): Promise<EstablishmentOption[]> => {
      const data = await getEstablishments();
      return data.map((e) => ({ id: e.id, title: e.title }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const timelineQuery = useQuery({
    queryKey: analyticsKeys.timeline({
      startDate,
      endDate,
      establishmentIds: selectedEstablishments,
      includeCashpad: showCashpad,
    }),
    queryFn: () =>
      getAnalyticsTimeline(startDate, endDate, selectedEstablishments, showCashpad),
    placeholderData: keepPreviousData,
  });

  const timelineRows = useMemo(
    () => timelineQuery.data ?? [],
    [timelineQuery.data]
  );

  // Colonnes = journées fiscales présentes sur la période, triées.
  const columns = useMemo(() => {
    const set = new Set<string>();
    for (const r of timelineRows) set.add(r.fiscal_date);
    return Array.from(set).sort();
  }, [timelineRows]);

  const openTimelineDrilldown = (row: TimelineRow, metric: TimelineCellMetric) => {
    const ddMetric: DrilldownMetric = metric === "organic" ? "gainsOrganic" : "receipts";

    // « Paiements PdB » = somme des lignes payées en cashback → ne montrer que ces receipts.
    const onlyCashbackPayments = metric === "pdb_payment";

    let filters: DrilldownFilters;
    if (!row.is_fallback_calendar && row.range_begin && row.range_end) {
      filters = {
        startDate: row.range_begin,
        endDate: new Date(Date.parse(row.range_end) + 1000).toISOString(),
        establishmentId: row.establishment_id,
        onlyCashbackPayments,
      };
    } else {
      filters = {
        startDate: row.fiscal_date,
        endDate: nextDay(row.fiscal_date),
        establishmentId: row.establishment_id,
        onlyCashbackPayments,
      };
    }

    const metricLabel =
      metric === "euro"
        ? "Euros Royaume (selon Royaume)"
        : metric === "pdb_payment"
          ? "Paiements PdB (selon Royaume)"
          : "PdB organiques";

    setDrilldownMetric(ddMetric);
    setDrilldownFilters(filters);
    setDrilldownTitle(
      `${row.establishment_title} — ${metricLabel} · ${formatDateFr(row.fiscal_date)}`
    );
    setDrilldownOpen(true);
  };

  const isLoading = timelineQuery.isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Activité par établissement et par journée fiscale (clôture → clôture).
          Paiements et génération de Paraiges de Bronze sur le Royaume.
        </p>
      </div>

      {/* Filtres — barre sticky pleine largeur, au-dessus du tableau qui défile dessous */}
      <div
        ref={filterBarRef}
        className="sticky -top-4 z-40 -mx-4 flex flex-wrap items-end gap-3 border-b bg-background px-4 py-3 sm:-top-6 sm:-mx-6 sm:px-6"
      >
        <EstablishmentMultiFilter
          establishments={establishmentsQuery.data ?? []}
          selected={selectedEstablishments}
          onChange={setSelectedEstablishments}
          open={estFilterOpen}
          onOpenChange={setEstFilterOpen}
        />

        {/* Comparaison Cashpad — calcul lourd, activable à la demande. */}
        <label
          className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
          title="Compare les encaissements Cashpad aux receipts Royaume. Calcul plus lent : à activer ponctuellement."
        >
          <Checkbox
            checked={showCashpad}
            onCheckedChange={(v) => setShowCashpad(v === true)}
          />
          <span>Montant Cashpad hors Royaume</span>
          {showCashpad && timelineQuery.isFetching && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </label>

        <div className="ml-auto">
          <TimelinePeriodRange
            mode={periodMode}
            date={date}
            onModeChange={setPeriodMode}
            onDateChange={setDate}
          />
        </div>
      </div>

      {/* Tableau timeline — pleine largeur (sort du padding du <main>) */}
      <div className="-mx-4 sm:-mx-6">
        <TimelineTable
          rows={timelineRows}
          columns={columns}
          loading={isLoading}
          onCellClick={openTimelineDrilldown}
          stickyHeaderTop={stickyTop}
          showCashpad={showCashpad}
        />
      </div>

      <DrilldownModal
        open={drilldownOpen}
        onOpenChange={setDrilldownOpen}
        metric={drilldownMetric}
        title={drilldownTitle}
        filters={drilldownFilters}
      />
    </div>
  );
}
