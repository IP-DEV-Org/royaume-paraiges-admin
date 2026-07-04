"use client";

import { Building2, Info } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  EstablishmentKpisRow,
  PdbDelta,
} from "@/lib/services/analyticsService";
import { EvolutionBadge } from "./evolution-badge";

/** Ligne du comparatif : KPIs courants + période précédente + delta PdB 7 j. */
export interface CompareRow extends EstablishmentKpisRow {
  /** Même établissement sur la période précédente ; null pendant le chargement. */
  prev: EstablishmentKpisRow | null;
  /** Delta paiements PdB Cashpad − Royaume sur 7 jours glissants ; null = pas de ligne timeline. */
  pdbDelta7d: PdbDelta | null;
}

function DeltaHeader() {
  return (
    <span className="inline-flex items-center gap-1">
      Δ PdB 7 j
      <Tooltip>
        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 hover:text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[300px] text-xs">
          Écart paiements PdB (Cashpad − Royaume) cumulé sur les 7 derniers
          jours, indépendant de la période sélectionnée. Seules les journées
          fiscales avec donnée Cashpad sont sommées ; une journée sans ticket
          Royaume ne produit pas de ligne. « — » = aucune donnée Cashpad.
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

function DeltaCell({ delta }: { delta: PdbDelta | null }) {
  const cents = delta?.deltaCents ?? null;
  if (cents === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-baseline gap-1.5 tabular-nums">
      <span
        className={cn(
          cents === 0 ? "text-emerald-600" : "font-medium text-amber-600"
        )}
      >
        {formatCurrency(cents)}
      </span>
      {delta && delta.daysWithData < 7 && (
        <span className="text-[10px] text-muted-foreground">
          {delta.daysWithData} j
        </span>
      )}
    </span>
  );
}

const columns: DataTableColumn<CompareRow>[] = [
  {
    key: "title",
    header: "Établissement",
    sortable: true,
    sortValue: (r) => r.establishment_title,
    cell: (r) => <span className="font-medium">{r.establishment_title}</span>,
  },
  {
    key: "pdbDelta7d",
    header: <DeltaHeader />,
    sortable: true,
    sortValue: (r) => r.pdbDelta7d?.deltaCents ?? null,
    cell: (r) => <DeltaCell delta={r.pdbDelta7d} />,
  },
  {
    key: "newClients",
    header: "Nouveaux clients",
    sortable: true,
    sortValue: (r) => r.new_clients,
    cell: (r) => (
      <span className="inline-flex items-baseline gap-2 tabular-nums">
        {r.new_clients.toLocaleString("fr-FR")}
        <EvolutionBadge
          current={r.new_clients}
          previous={r.prev ? r.prev.new_clients : null}
        />
      </span>
    ),
  },
  {
    key: "activeClients",
    header: "Clients actifs",
    sortable: true,
    sortValue: (r) => r.active_clients,
    cell: (r) => (
      <span className="tabular-nums">
        {r.active_clients.toLocaleString("fr-FR")}
      </span>
    ),
  },
  {
    key: "sales",
    header: "Tickets",
    sortable: true,
    sortValue: (r) => r.sales_count,
    cell: (r) => (
      <span className="tabular-nums">{r.sales_count.toLocaleString("fr-FR")}</span>
    ),
  },
  {
    key: "euros",
    header: "CA €",
    sortable: true,
    sortValue: (r) => r.euro_cents,
    cell: (r) => (
      <span className="tabular-nums">{formatCurrency(r.euro_cents)}</span>
    ),
  },
  {
    key: "pdbSpent",
    header: "PdB dépensés",
    sortable: true,
    sortValue: (r) => r.pdb_spent_cents,
    cell: (r) => (
      <span className="tabular-nums">{formatCurrency(r.pdb_spent_cents)}</span>
    ),
  },
  {
    key: "pdbGenerated",
    header: "PdB générés",
    sortable: true,
    sortValue: (r) => r.pdb_generated_cents,
    cell: (r) => (
      <span className="tabular-nums">
        {formatCurrency(r.pdb_generated_cents)}
      </span>
    ),
  },
  {
    key: "employees",
    header: "Salariés",
    sortable: true,
    sortValue: (r) => r.employees_count,
    cell: (r) => <span className="tabular-nums">{r.employees_count}</span>,
  },
];

export function EstablishmentsCompareTable({
  rows,
  loading,
  selectedId,
  onSelect,
}: {
  rows: CompareRow[];
  loading: boolean;
  selectedId: number | null;
  onSelect: (row: CompareRow) => void;
}) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      rowKey={(r) => r.establishment_id}
      loading={loading}
      skeletonRows={7}
      onRowClick={onSelect}
      rowClassName={(r) =>
        r.establishment_id === selectedId ? "bg-primary/5" : ""
      }
      emptyState={
        <EmptyState
          icon={Building2}
          title="Aucun établissement"
          description="Aucun établissement n'est enregistré."
        />
      }
    />
  );
}
