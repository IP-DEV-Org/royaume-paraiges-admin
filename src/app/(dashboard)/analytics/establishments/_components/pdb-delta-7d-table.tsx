"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatCurrency } from "@/lib/utils";
import type { TimelineRow } from "@/lib/services/analyticsService";

function formatFiscalDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * Détail par journée fiscale des paiements PdB Cashpad vs Royaume sur les
 * 7 derniers jours. Une journée sans clôture Cashpad (fallback calendaire)
 * n'a pas de donnée Cashpad → « — » + badge « cal. » (convention /analytics).
 * Les journées sans aucun receipt Royaume n'apparaissent pas.
 */
export function PdbDelta7dTable({ daily }: { daily: TimelineRow[] }) {
  if (daily.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun ticket Royaume sur les 7 derniers jours pour cet établissement.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Journée fiscale</TableHead>
          <TableHead className="text-right">PdB selon Cashpad</TableHead>
          <TableHead className="text-right">PdB selon Royaume</TableHead>
          <TableHead className="text-right">Différence (Cashpad − Royaume)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {daily.map((row) => {
          const hasCashpad = row.pdb_cashpad_cents !== null;
          const delta = hasCashpad
            ? (row.pdb_cashpad_cents as number) - row.pdb_royaume_cents
            : null;
          return (
            <TableRow key={row.fiscal_date}>
              <TableCell>
                <span className="inline-flex items-center gap-1.5">
                  {formatFiscalDate(row.fiscal_date)}
                  {row.is_fallback_calendar && (
                    <span className="text-[10px] font-normal text-amber-600">
                      cal.
                    </span>
                  )}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {hasCashpad
                  ? formatCurrency(row.pdb_cashpad_cents as number)
                  : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(row.pdb_royaume_cents)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums",
                  delta === null
                    ? "text-muted-foreground"
                    : delta === 0
                      ? "text-emerald-600"
                      : "font-medium text-amber-600"
                )}
              >
                {delta === null ? "—" : formatCurrency(delta)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
