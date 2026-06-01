"use client";

import { useRef } from "react";
import { Store } from "lucide-react";

import type { TimelineRow } from "@/lib/services/analyticsService";
import { cn, formatCurrency } from "@/lib/utils";

// =============================================================================
// Tableau timeline : lignes de métriques groupées par établissement, colonnes =
// journées fiscales (clôtures).
//
// Entête FIGÉ en haut (sticky page) sans scrollbar verticale interne : on rend
// DEUX tables alignées (largeurs de colonnes fixes) — un entête sticky séparé et
// le corps en flux normal. Le défilement horizontal du corps est synchronisé en
// JS sur l'entête. Le scroll vertical reste celui de la page (<main>).
// =============================================================================

export type TimelineCellMetric = "payments" | "transactions" | "organic";

// Largeurs de colonnes FIXES (px) → l'entête et le corps s'alignent sans mesure.
const FIRST_COL_W = 240;
const COL_W = 132;

interface MetricConfig {
  key: TimelineCellMetric | "cashpad_euro";
  label: string;
  hint: string;
  kind: "currency" | "placeholder";
  metric?: TimelineCellMetric;
  field?: "pdb_payments_cents" | "transactions_amount_cents" | "pdb_organic_cents";
}

const METRICS: MetricConfig[] = [
  {
    key: "payments",
    label: "Paiements en PdB",
    hint: "Total des Paraiges de Bronze utilisés en paiement (1 PdB = 0,01 €)",
    kind: "currency",
    metric: "payments",
    field: "pdb_payments_cents",
  },
  {
    key: "transactions",
    label: "Montant des transactions",
    hint: "Somme des montants des tickets enregistrés sur le Royaume",
    kind: "currency",
    metric: "transactions",
    field: "transactions_amount_cents",
  },
  {
    key: "organic",
    label: "PdB organiques générés",
    hint: "Paraiges de Bronze gagnés en dépensant — cashback (1 PdB = 0,01 €)",
    kind: "currency",
    metric: "organic",
    field: "pdb_organic_cents",
  },
  {
    key: "cashpad_euro",
    label: "Euros Cashpad « euro royaume »",
    hint: "À venir — paiements en euro royaume côté Cashpad",
    kind: "placeholder",
  },
];

function formatColumnLabel(fiscalDate: string): string {
  return new Date(`${fiscalDate}T00:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

interface TimelineTableProps {
  rows: TimelineRow[];
  columns: string[];
  loading: boolean;
  onCellClick: (row: TimelineRow, metric: TimelineCellMetric) => void;
  /** Décalage (px) auquel figer l'entête : hauteur de la barre de filtres. */
  stickyHeaderTop?: number;
}

export function TimelineTable({
  rows,
  columns,
  loading,
  onCellClick,
  stickyHeaderTop = 0,
}: TimelineTableProps) {
  const headerScrollRef = useRef<HTMLDivElement>(null);

  // Le corps pilote l'entête : on mirroir le scroll horizontal.
  const handleBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // Groupement par établissement (ordre alphabétique stable depuis la RPC).
  const groups = new Map<
    number,
    { title: string; byDate: Map<string, TimelineRow> }
  >();
  for (const r of rows) {
    let g = groups.get(r.establishment_id);
    if (!g) {
      g = { title: r.establishment_title, byDate: new Map() };
      groups.set(r.establishment_id, g);
    }
    g.byDate.set(r.fiscal_date, r);
  }

  // Une colonne est « calendaire » (fallback) si AUCUNE clôture réelle ne la couvre.
  const fallbackColumns = new Set<string>();
  for (const c of columns) {
    const hasReal = rows.some((r) => r.fiscal_date === c && !r.is_fallback_calendar);
    if (!hasReal) fallbackColumns.add(c);
  }

  if (loading) {
    return (
      <div className="space-y-2 px-4 sm:px-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-muted/50" />
        ))}
      </div>
    );
  }

  if (groups.size === 0 || columns.length === 0) {
    return (
      <div className="mx-4 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center sm:mx-6">
        <Store className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Aucune transaction sur cette période.
        </p>
      </div>
    );
  }

  const tableWidth = FIRST_COL_W + columns.length * COL_W;

  const cellValue = (row: TimelineRow | undefined, m: MetricConfig): string => {
    if (!row || !m.field) return "—";
    return formatCurrency(row[m.field]);
  };

  const colgroup = (
    <colgroup>
      <col style={{ width: FIRST_COL_W }} />
      {columns.map((c) => (
        <col key={c} style={{ width: COL_W }} />
      ))}
    </colgroup>
  );

  return (
    <div>
      {/* Entête figé — table séparée, scroll horizontal mirroré (overflow caché). */}
      <div
        ref={headerScrollRef}
        className="sticky z-20 overflow-hidden border-y bg-muted"
        style={{ top: stickyHeaderTop }}
      >
        <table
          className="table-fixed border-collapse text-sm"
          style={{ width: tableWidth, minWidth: "100%" }}
        >
          {colgroup}
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-r border-border/50 bg-muted px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Métrique
              </th>
              {columns.map((c) => (
                <th
                  key={c}
                  className="border-l border-border/30 bg-muted px-3 py-2.5 text-right text-xs font-semibold text-foreground"
                  title={
                    fallbackColumns.has(c)
                      ? "Jour calendaire — aucune clôture Cashpad rattachée"
                      : "Journée fiscale (clôture → clôture)"
                  }
                >
                  <span className="block capitalize">{formatColumnLabel(c)}</span>
                  {fallbackColumns.has(c) && (
                    <span className="text-[10px] font-normal text-amber-600">cal.</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      {/* Corps — flux normal (scroll vertical = page), scroll horizontal interne. */}
      <div
        className="overflow-x-auto border-b"
        onScroll={handleBodyScroll}
      >
        <table
          className="table-fixed border-collapse text-sm"
          style={{ width: tableWidth, minWidth: "100%" }}
        >
          {colgroup}
          <tbody>
            {Array.from(groups.entries()).map(([etabId, group], gi) => (
              <GroupRows
                key={etabId}
                title={group.title}
                byDate={group.byDate}
                columns={columns}
                cellValue={cellValue}
                onCellClick={onCellClick}
                isFirst={gi === 0}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupRows({
  title,
  byDate,
  columns,
  cellValue,
  onCellClick,
  isFirst,
}: {
  title: string;
  byDate: Map<string, TimelineRow>;
  columns: string[];
  cellValue: (row: TimelineRow | undefined, m: MetricConfig) => string;
  onCellClick: (row: TimelineRow, metric: TimelineCellMetric) => void;
  isFirst: boolean;
}) {
  return (
    <>
      {/* En-tête d'établissement : séparateur épais entre groupes. */}
      <tr
        className={cn(
          "bg-muted/20",
          !isFirst && "border-t-4 border-foreground/15"
        )}
      >
        <th
          scope="row"
          className="sticky left-0 z-10 border-r border-border/50 bg-muted px-4 py-2 text-left text-sm font-bold text-foreground"
        >
          <span className="flex items-start gap-2">
            <Store className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="break-words">{title}</span>
          </span>
        </th>
        {columns.map((c) => (
          <td key={c} className="border-l border-border/30 bg-muted/20" />
        ))}
      </tr>

      {METRICS.map((m, idx) => (
        <tr key={m.key} className={cn("border-t", idx === 0 && "border-t-0")}>
          <th
            scope="row"
            className="sticky left-0 z-10 border-r border-border/50 bg-background px-4 py-2 pl-10 text-left font-normal text-muted-foreground"
            title={m.hint}
          >
            <span className="block break-words">{m.label}</span>
          </th>
          {columns.map((c) => {
            const row = byDate.get(c);
            const value = cellValue(row, m);
            const clickable = m.metric && row && value !== "—";
            return (
              <td
                key={c}
                className={cn(
                  "border-l border-border/30 px-3 py-2 text-right tabular-nums",
                  m.kind === "placeholder" && "text-muted-foreground/40",
                  value === "—" && "text-muted-foreground/40",
                  clickable &&
                    "cursor-pointer hover:bg-accent hover:text-accent-foreground"
                )}
                onClick={clickable ? () => onCellClick(row!, m.metric!) : undefined}
              >
                {value}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
