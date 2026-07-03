"use client";

import { CheckCircle2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import type { ReconciliationRow } from "@/lib/services/reconciliationService";
import {
  ConfidenceCell,
  DateTimeCell,
  deltaColorClass,
  formatDelta,
  formatEuro,
  getCustomerLabel,
  SkeletonRows,
} from "./shared";

interface MatchedCardProps {
  rows: ReconciliationRow[];
  loading: boolean;
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
    header: "Cashpad",
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
    key: "confidence",
    header: "Confiance",
    sortable: true,
    sortValue: (r) => r.confidence_score,
    cell: (r) => <ConfidenceCell score={r.confidence_score} />,
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
    key: "customer",
    header: "Client",
    sortable: true,
    sortValue: (r) => getCustomerLabel(r.receipt.customer),
    cellClassName: "text-sm",
    cell: (r) => getCustomerLabel(r.receipt.customer),
  },
  {
    key: "cashpad_user",
    header: "Serveur",
    sortable: true,
    sortValue: (r) => r.cashpad_snapshot?.cashpad_user_name,
    cellClassName: "text-sm",
    cell: (r) => r.cashpad_snapshot?.cashpad_user_name ?? "—",
  },
];

/** Receipts Royaume avec leur ticket Cashpad correspondant. */
export function MatchedCard({ rows, loading, onSelect }: MatchedCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />
          Matchés ({rows.length})
        </CardTitle>
        <CardDescription>
          Receipts Royaume avec leur ticket Cashpad correspondant, enrichis du serveur et des
          produits vendus.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {loading ? (
          <SkeletonRows rows={6} cols={6} />
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed">
            <EmptyState
              title="Aucun match sur la période"
              description="Lance une réconciliation pour cette date."
              className="py-6"
            />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            rowKey={(r) => r.id}
            onRowClick={onSelect}
            rowClassName="hover:bg-muted/50"
          />
        )}
      </CardContent>
    </Card>
  );
}
