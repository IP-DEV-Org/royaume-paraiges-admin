"use client";

import { useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { analyticsKeys } from "@/lib/queries/keys";
import {
  computePdbDeltas,
  getAnalyticsTimeline,
  getEstablishmentKpis,
} from "@/lib/services/analyticsService";
import { PageHeader } from "@/components/layout/page-header";
import {
  formatPeriodLabel,
  getPeriodBounds,
  PeriodRange,
  shiftPeriod,
  todayUtcISO,
  type PeriodMode,
} from "@/components/period-range";
import {
  EstablishmentsCompareTable,
  type CompareRow,
} from "./_components/establishments-compare-table";
import { EstablishmentDetail } from "./_components/establishment-detail";

/** Bornes de la fenêtre 7 jours glissants (aujourd'hui − 6 → aujourd'hui, UTC). */
function rolling7dBounds(): { startDate: string; endDate: string } {
  const endDate = todayUtcISO();
  const d = new Date(`${endDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 6);
  return { startDate: d.toISOString().slice(0, 10), endDate };
}

export default function EstablishmentAnalyticsPage() {
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [date, setDate] = useState(() => todayUtcISO());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const bounds = useMemo(
    () => getPeriodBounds(periodMode, date),
    [periodMode, date]
  );
  // Période calendaire précédente (mois vs mois, semaine vs semaine…) —
  // jamais une soustraction de N jours.
  const prevBounds = useMemo(
    () => getPeriodBounds(periodMode, shiftPeriod(date, periodMode, -1)),
    [periodMode, date]
  );
  const delta7Bounds = useMemo(() => rolling7dBounds(), []);

  const currentQuery = useQuery({
    queryKey: analyticsKeys.establishmentKpis(bounds),
    queryFn: () => getEstablishmentKpis(bounds.startDate, bounds.endDate),
    placeholderData: keepPreviousData,
  });

  const previousQuery = useQuery({
    queryKey: analyticsKeys.establishmentKpis(prevBounds),
    queryFn: () => getEstablishmentKpis(prevBounds.startDate, prevBounds.endDate),
    placeholderData: keepPreviousData,
  });

  // Fenêtre 7 j glissants fixe, indépendante du sélecteur de période.
  // includeCashpad=true : l'agrégation snapshot coûte ~0,25 s → staleTime long.
  const timelineQuery = useQuery({
    queryKey: analyticsKeys.timeline({
      ...delta7Bounds,
      establishmentIds: [],
      includeCashpad: true,
    }),
    queryFn: () =>
      getAnalyticsTimeline(
        delta7Bounds.startDate,
        delta7Bounds.endDate,
        undefined,
        true
      ),
    staleTime: 5 * 60 * 1000,
  });

  const rows: CompareRow[] = useMemo(() => {
    const current = currentQuery.data ?? [];
    const previousById = new Map(
      (previousQuery.data ?? []).map((r) => [r.establishment_id, r])
    );
    const deltasById = timelineQuery.data
      ? computePdbDeltas(timelineQuery.data)
      : null;
    return current.map((r) => ({
      ...r,
      prev: previousById.get(r.establishment_id) ?? null,
      pdbDelta7d: deltasById?.get(r.establishment_id) ?? null,
    }));
  }, [currentQuery.data, previousQuery.data, timelineQuery.data]);

  const selectedRow =
    rows.find((r) => r.establishment_id === selectedId) ?? null;

  const handleSelect = (row: CompareRow) => {
    setSelectedId((prev) => {
      const next =
        prev === row.establishment_id ? null : row.establishment_id;
      if (next !== null) {
        // Laisse la fiche se monter avant de scroller.
        requestAnimationFrame(() =>
          detailRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
        );
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics établissements"
        description="Chiffres clés par établissement : activité, nouveaux clients et écart de paiements PdB avec Cashpad."
      />

      <PeriodRange
        mode={periodMode}
        date={date}
        onModeChange={setPeriodMode}
        onDateChange={setDate}
      />

      <EstablishmentsCompareTable
        rows={rows}
        loading={currentQuery.isLoading}
        selectedId={selectedId}
        onSelect={handleSelect}
      />

      <div ref={detailRef}>
        {selectedRow ? (
          <EstablishmentDetail
            row={selectedRow}
            periodLabel={formatPeriodLabel(
              periodMode,
              bounds.startDate,
              bounds.endDate
            )}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Cliquez sur un établissement pour afficher sa fiche détaillée.
          </p>
        )}
      </div>
    </div>
  );
}
