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
import { DateTimeCell, formatEuro, getCustomerLabel, SkeletonRows } from "./shared";

interface OrphansCardProps {
  rows: ReconciliationRow[];
  loading: boolean;
  onSelect: (row: ReconciliationRow) => void;
}

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Horodatage</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Établissement</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Signal</TableHead>
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
                  <TableCell>{formatEuro(r.receipt.amount)}</TableCell>
                  <TableCell className="text-sm">
                    {r.receipt.establishment?.title ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {getCustomerLabel(r.receipt.customer)}
                  </TableCell>
                  <TableCell>
                    {r.cancelled_match_id && (
                      <Badge className="bg-rose-500/15 text-rose-700 hover:bg-rose-500/20 dark:text-rose-400">
                        Cashpad annulé
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
