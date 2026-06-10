"use client";

import { CheckCircle2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

function MatchedRow({
  row,
  onSelect,
}: {
  row: ReconciliationRow;
  onSelect: (row: ReconciliationRow) => void;
}) {
  const snap = row.cashpad_snapshot;
  const customerLabel = getCustomerLabel(row.receipt.customer);

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => onSelect(row)}
    >
      <TableCell className="font-mono text-xs">#{row.receipt.id}</TableCell>
      <TableCell className="whitespace-nowrap">
        <DateTimeCell iso={row.receipt.created_at} />
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <DateTimeCell iso={snap?.closed_at} />
      </TableCell>
      <TableCell
        className={`whitespace-nowrap text-xs font-medium tabular-nums ${deltaColorClass(row.time_delta_seconds)}`}
      >
        {formatDelta(row.time_delta_seconds)}
      </TableCell>
      <TableCell>
        <ConfidenceCell score={row.confidence_score} />
      </TableCell>
      <TableCell>{formatEuro(row.receipt.amount)}</TableCell>
      <TableCell className="text-sm">{row.receipt.establishment?.title ?? "—"}</TableCell>
      <TableCell className="text-sm">{customerLabel}</TableCell>
      <TableCell className="text-sm">{snap?.cashpad_user_name ?? "—"}</TableCell>
    </TableRow>
  );
}

interface MatchedCardProps {
  rows: ReconciliationRow[];
  loading: boolean;
  onSelect: (row: ReconciliationRow) => void;
}

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Royaume</TableHead>
                <TableHead>Cashpad</TableHead>
                <TableHead>Δ</TableHead>
                <TableHead>Confiance</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Établissement</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Serveur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <MatchedRow key={r.id} row={r} onSelect={onSelect} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
