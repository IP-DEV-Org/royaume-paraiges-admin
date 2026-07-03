"use client";

import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { DateTimeCell, formatEuro, getCustomerLabel, SkeletonRows } from "./shared";

interface OrphansCardProps {
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
    key: "created_at",
    header: "Horodatage",
    sortable: true,
    sortValue: (r) => r.receipt.created_at,
    cellClassName: "whitespace-nowrap",
    cell: (r) => <DateTimeCell iso={r.receipt.created_at} />,
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
    key: "signal",
    header: "Signal",
    sortable: true,
    sortValue: (r) => (r.cancelled_match_id ? 1 : 0),
    cell: (r) =>
      r.cancelled_match_id ? (
        <Badge className="bg-rose-500/15 text-rose-700 hover:bg-rose-500/20 dark:text-rose-400">
          Cashpad annulé
        </Badge>
      ) : null,
  },
];

/** Receipts Royaume sans ticket Cashpad correspondant — anomalies à investiguer. */
export function OrphansCard({ rows, loading, onSelect }: OrphansCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
          Orphelins Royaume ({rows.length})
        </CardTitle>
        <CardDescription>
          Receipts enregistrés dans l&apos;app mais sans ticket Cashpad correspondant dans la fenêtre
          ±5 min. Anomalies à investiguer (un paiement sans passage en caisse ?).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <SkeletonRows rows={4} cols={5} />
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed">
            <EmptyState
              title="Aucun orphelin sur la période"
              description="Tous les receipts Royaume ont un ticket Cashpad correspondant."
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
