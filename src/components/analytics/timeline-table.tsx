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

// Métriques cliquables → ouvrent le drilldown des receipts/gains correspondants.
export type TimelineCellMetric = "euro" | "pdb_payment" | "organic";

// Largeurs de colonnes FIXES (px) → l'entête et le corps s'alignent sans mesure.
const FIRST_COL_W = 340;
const COL_W = 200;

type CurrencyField =
  | "euro_cashpad_other_cents"
  | "euro_cashpad_cents"
  | "euro_royaume_cents"
  | "pdb_cashpad_cents"
  | "pdb_royaume_cents"
  | "pdb_organic_cents"
  | "pdb_quest_cents";

interface MetricConfig {
  key: string;
  label: string;
  hint: string;
  /** `currency` = montant d'un champ ; `diff` = écart Cashpad − Royaume calculé. */
  kind: "currency" | "diff";
  /** Présent → cellule cliquable (ouvre le drilldown). */
  metric?: TimelineCellMetric;
  /** Champ affiché pour `kind: "currency"`. */
  field?: CurrencyField;
  /** Paire (Cashpad, Royaume) pour `kind: "diff"` → écart = Cashpad − Royaume. */
  diff?: { cashpad: CurrencyField; royaume: CurrencyField };
  /** Trait épais avant cette ligne (séparation de blocs). */
  separatorBefore?: boolean;
}

const METRICS: MetricConfig[] = [
  // Bloc 0 — Activité caisse Cashpad hors Royaume
  {
    key: "euro_cashpad_other",
    label: "Euros Cashpad",
    hint: "Montant des paiements Cashpad sans lien avec le Royaume (tous modes sauf « Euros Royaume » et « Paraiges de Bronze ») : Euros simples, CB, Espèces, Ticket resto, Virement…",
    kind: "currency",
    field: "euro_cashpad_other_cents",
  },
  // Bloc 1 — Euros Royaume (euros payés par les membres Royaume)
  {
    key: "euro_cashpad",
    label: "Euros Royaume — selon Cashpad",
    hint: "Montant total des paiements enregistrés en caisse Cashpad avec le mode de paiement « Euros Royaume »",
    kind: "currency",
    field: "euro_cashpad_cents",
    separatorBefore: true,
  },
  {
    key: "euro_royaume",
    label: "Euros Royaume — selon Royaume",
    hint: "Montant en euros (carte + espèces, hors PdB) des receipts scannés avec l'application Scanner du Royaume",
    kind: "currency",
    metric: "euro",
    field: "euro_royaume_cents",
  },
  {
    key: "euro_diff",
    label: "Différence (Cashpad − Royaume)",
    hint: "Écart entre les Euros Royaume encaissés côté Cashpad et les euros scannés côté Royaume. Vert = aucun écart, ambre = divergence à investiguer.",
    kind: "diff",
    diff: { cashpad: "euro_cashpad_cents", royaume: "euro_royaume_cents" },
  },
  // Bloc 2 — Paiements en Paraiges de Bronze (cashback)
  {
    key: "pdb_cashpad",
    label: "Paiements PdB — selon Cashpad",
    hint: "Montant total des paiements enregistrés en caisse Cashpad avec le mode de paiement « Paraiges de Bronze »",
    kind: "currency",
    field: "pdb_cashpad_cents",
    separatorBefore: true,
  },
  {
    key: "pdb_royaume",
    label: "Paiements PdB — selon Royaume",
    hint: "Montant des receipts scannés réglés en Paraiges de Bronze (cashback) côté Royaume (1 PdB = 0,01 €)",
    kind: "currency",
    metric: "pdb_payment",
    field: "pdb_royaume_cents",
  },
  {
    key: "pdb_diff",
    label: "Différence (Cashpad − Royaume)",
    hint: "Écart entre les PdB encaissés côté Cashpad et les paiements PdB scannés côté Royaume. Vert = aucun écart, ambre = divergence à investiguer.",
    kind: "diff",
    diff: { cashpad: "pdb_cashpad_cents", royaume: "pdb_royaume_cents" },
  },
  // Bloc 3 — Génération de Paraiges de Bronze
  {
    key: "organic",
    label: "PdB organiques générés",
    hint: "Paraiges de Bronze gagnés en dépensant (cashback organique, hors quêtes) — 1 PdB = 0,01 €",
    kind: "currency",
    metric: "organic",
    field: "pdb_organic_cents",
    separatorBefore: true,
  },
  {
    key: "quest",
    label: "PdB gains générés",
    hint: "Paraiges de Bronze gagnés via les quêtes, rattachés à l'établissement du dernier receipt déclencheur (1 PdB = 0,01 €)",
    kind: "currency",
    field: "pdb_quest_cents",
  },
];

function formatColumnLabel(fiscalDate: string): string {
  return new Date(`${fiscalDate}T00:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

type CellTone = "normal" | "muted" | "match" | "mismatch";

const TONE_CLASS: Record<CellTone, string> = {
  normal: "",
  muted: "text-muted-foreground/40",
  match: "text-emerald-600",
  mismatch: "font-medium text-amber-600",
};

/** Écart signé en € : « +12,30 € » / « −12,30 € » / « 0,00 € ». */
function formatDiff(cents: number): string {
  if (cents === 0) return formatCurrency(0);
  return `${cents > 0 ? "+" : "−"}${formatCurrency(Math.abs(cents))}`;
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

  const renderCell = (
    row: TimelineRow | undefined,
    m: MetricConfig
  ): { text: string; tone: CellTone } => {
    if (!row) return { text: "—", tone: "muted" };

    if (m.kind === "diff" && m.diff) {
      const cashpad = row[m.diff.cashpad];
      const royaume = row[m.diff.royaume];
      // Pas de donnée Cashpad (fallback calendaire) → écart non calculable.
      if (cashpad == null) return { text: "—", tone: "muted" };
      const diff = cashpad - (royaume ?? 0);
      return { text: formatDiff(diff), tone: diff === 0 ? "match" : "mismatch" };
    }

    if (!m.field) return { text: "—", tone: "muted" };
    const v = row[m.field];
    if (v == null) return { text: "—", tone: "muted" };
    return { text: formatCurrency(v), tone: "normal" };
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
          style={{ width: tableWidth }}
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
          style={{ width: tableWidth }}
        >
          {colgroup}
          <tbody>
            {Array.from(groups.entries()).map(([etabId, group], gi) => (
              <GroupRows
                key={etabId}
                title={group.title}
                byDate={group.byDate}
                columns={columns}
                renderCell={renderCell}
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
  renderCell,
  onCellClick,
  isFirst,
}: {
  title: string;
  byDate: Map<string, TimelineRow>;
  columns: string[];
  renderCell: (
    row: TimelineRow | undefined,
    m: MetricConfig
  ) => { text: string; tone: CellTone };
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

      {METRICS.map((m, idx) => {
        const isDiff = m.kind === "diff";
        // Lignes de métriques en blanc ; seules les lignes de différence (delta)
        // ont un fond différencié.
        const rowBg = isDiff ? "bg-muted/60" : "bg-background";
        return (
          <tr
            key={m.key}
            className={cn(
              "border-t",
              idx === 0 && "border-t-0",
              m.separatorBefore && "border-t-2 border-border",
              rowBg
            )}
          >
            <th
              scope="row"
              className={cn(
                "sticky left-0 z-10 border-r border-border/50 px-4 py-2 pl-10 text-left font-normal text-muted-foreground",
                rowBg,
                isDiff && "italic"
              )}
              title={m.hint}
            >
              <span className="block break-words">{m.label}</span>
            </th>
            {columns.map((c) => {
              const row = byDate.get(c);
              const { text, tone } = renderCell(row, m);
              const clickable = m.metric && row && text !== "—";
              return (
                <td
                  key={c}
                  className={cn(
                    "border-l border-border/30 px-3 py-2 text-right tabular-nums",
                    rowBg,
                    TONE_CLASS[tone],
                    clickable &&
                      "cursor-pointer hover:bg-accent hover:text-accent-foreground"
                  )}
                  onClick={clickable ? () => onCellClick(row!, m.metric!) : undefined}
                >
                  {text}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
