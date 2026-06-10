"use client";

import { HelpCircle } from "lucide-react";

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
import type { ReconciliationRow } from "@/lib/services/reconciliationService";
import { DateTimeCell, deltaColorClass, formatDelta, formatEuro } from "./shared";

interface AmbiguousCardProps {
  rows: ReconciliationRow[];
  onSelect: (row: ReconciliationRow) => void;
}

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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Royaume</TableHead>
              <TableHead>Cashpad (meilleur)</TableHead>
              <TableHead>Δ</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Établissement</TableHead>
              <TableHead>Candidats</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSelect(r)}
              >
                <TableCell className="font-mono text-xs">#{r.receipt.id}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <DateTimeCell iso={r.receipt.created_at} />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <DateTimeCell iso={r.cashpad_snapshot?.closed_at} />
                </TableCell>
                <TableCell
                  className={`whitespace-nowrap text-xs font-medium tabular-nums ${deltaColorClass(r.time_delta_seconds)}`}
                >
                  {formatDelta(r.time_delta_seconds)}
                </TableCell>
                <TableCell>{formatEuro(r.receipt.amount)}</TableCell>
                <TableCell className="text-sm">
                  {r.receipt.establishment?.title ?? "—"}
                </TableCell>
                <TableCell className="text-sm">{r.candidates?.length ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
