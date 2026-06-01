"use client";

import { Info } from "lucide-react";

import type { TimelineGlobalRow } from "@/lib/services/analyticsService";
import { cn, formatCurrency } from "@/lib/utils";

// =============================================================================
// Bloc global « Royaume — toutes enseignes » : PdB récompense / total générés,
// par jour calendaire. Les récompenses (bonus_cashback_*) n'ont pas
// d'establishment_id rattaché — affichage PROVISOIRE en attendant le modèle de
// dettes inter-établissements (attribution au prorata des dépenses qualifiantes).
// =============================================================================

export type GlobalCellMetric = "gainsRewards" | "gainsAll";

function formatColumnLabel(fiscalDate: string): string {
  return new Date(`${fiscalDate}T00:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

interface GlobalMetricConfig {
  label: string;
  hint: string;
  metric: GlobalCellMetric;
  field: "pdb_reward_cents" | "pdb_total_generated_cents";
}

const GLOBAL_METRICS: GlobalMetricConfig[] = [
  {
    label: "PdB récompense générés",
    hint: "Bonus (quêtes, classements, manuels…) — non rattachables à un établissement à ce jour",
    metric: "gainsRewards",
    field: "pdb_reward_cents",
  },
  {
    label: "PdB total générés",
    hint: "Organiques + récompense, toutes enseignes confondues",
    metric: "gainsAll",
    field: "pdb_total_generated_cents",
  },
];

interface TimelineGlobalBlockProps {
  rows: TimelineGlobalRow[];
  columns: string[];
  loading: boolean;
  onCellClick: (fiscalDate: string, metric: GlobalCellMetric) => void;
}

export function TimelineGlobalBlock({
  rows,
  columns,
  loading,
  onCellClick,
}: TimelineGlobalBlockProps) {
  const byDate = new Map<string, TimelineGlobalRow>();
  for (const r of rows) byDate.set(r.fiscal_date, r);

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Les PdB récompense ne portent pas d&apos;établissement en base : ils sont
          affichés globalement (par jour calendaire) en attendant le futur modèle de{" "}
          <span className="font-medium">dettes inter-établissements</span> qui les
          ventilera au prorata des dépenses qualifiantes.
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted/50" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 min-w-[220px] border-b border-r border-border/50 bg-muted px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Royaume — toutes enseignes
                </th>
                {columns.map((c) => (
                  <th
                    key={c}
                    className="min-w-[120px] border-b border-l border-border/30 bg-muted px-3 py-2.5 text-right text-xs font-semibold text-foreground"
                  >
                    <span className="block capitalize">{formatColumnLabel(c)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GLOBAL_METRICS.map((m, idx) => (
                <tr key={m.metric} className={cn("border-t", idx === 0 && "border-t-0")}>
                  <th
                    scope="row"
                    className="sticky left-0 z-20 border-r border-border/50 bg-background px-4 py-2 text-left font-normal text-muted-foreground"
                    title={m.hint}
                  >
                    {m.label}
                  </th>
                  {columns.map((c) => {
                    const row = byDate.get(c);
                    const value = row ? formatCurrency(row[m.field]) : "—";
                    const clickable = !!row;
                    return (
                      <td
                        key={c}
                        className={cn(
                          "border-l border-border/30 px-3 py-2 text-right tabular-nums",
                          !row && "text-muted-foreground/40",
                          clickable &&
                            "cursor-pointer hover:bg-accent hover:text-accent-foreground"
                        )}
                        onClick={clickable ? () => onCellClick(c, m.metric) : undefined}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
