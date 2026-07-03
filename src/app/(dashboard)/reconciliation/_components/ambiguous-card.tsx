"use client";

import { HelpCircle } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import type { ReconciliationRow } from "@/lib/services/reconciliationService";
import { DateTimeCell, deltaColorClass, formatDelta, formatEuro } from "./shared";

interface AmbiguousCardProps {
  rows: ReconciliationRow[];
  onSelect: (row: ReconciliationRow) => void;
}

const columns: DataTableColumn<ReconciliationRow>[] = [
  {
    key: "id",
    header: "ID",
    sortable: true,
    sortValue: (r) => r.receipt.id,
    cellClassName: "font-mono text-xs",
    cell: (r) => <>#{r.receipt.id}</>,
  },
  {
    key: "royaume",
    header: "Royaume",
    sortable: true,
    sortValue: (r) => r.receipt.created_at,
    cellClassName: "whitespace-nowrap",
    cell: (r) => <DateTimeCell iso={r.receipt.created_at} />,
  },
  {
    key: "cashpad",
    header: "Cashpad (meilleur)",
    sortable: true,
    sortValue: (r) => r.cashpad_snapshot?.closed_at,
    cellClassName: "whitespace-nowrap",
    cell: (r) => <DateTimeCell iso={r.cashpad_snapshot?.closed_at} />,
  },
  {
    key: "delta",
    header: "Δ",
    sortable: true,
    sortValue: (r) =>
      r.time_delta_seconds === null ? null : Math.abs(r.time_delta_seconds),
    cell: (r) => (
      <span
        className={`whitespace-nowrap text-xs font-medium tabular-nums ${deltaColorClass(r.time_delta_seconds)}`}
      >
        {formatDelta(r.time_delta_seconds)}
      </span>
    ),
  },
  {
    key: "amount",
    header: "Montant",
    sortable: true,
    sortValue: (r) => r.receipt.amount,
    cell: (r) => formatEuro(r.receipt.amount),
  },
  {
    key: "establishment",
    header: "Établissement",
    sortable: true,
    sortValue: (r) => r.receipt.establishment?.title,
    cellClassName: "text-sm",
    cell: (r) => r.receipt.establishment?.title ?? "—",
  },
  {
    key: "candidates",
    header: "Candidats",
    sortable: true,
    sortValue: (r) => r.candidates?.length ?? 0,
    cellClassName: "text-sm",
    cell: (r) => r.candidates?.length ?? 0,
  },
];

/** Receipts avec plusieurs tickets Cashpad candidats — arbitrage manuel requis. */
export function AmbiguousCard({ rows, onSelect }: AmbiguousCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-violet-500" aria-hidden="true" />
          Ambigus à arbitrer ({rows.length})
        </CardTitle>
        <CardDescription>
          Plusieurs tickets Cashpad matchent dans la fenêtre. Le meilleur candidat (le plus proche
          dans le temps) est pré-sélectionné — confirme ou choisis-en un autre manuellement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(r) => r.id}
          onRowClick={onSelect}
          rowClassName="hover:bg-muted/50"
        />
      </CardContent>
    </Card>
  );
}
