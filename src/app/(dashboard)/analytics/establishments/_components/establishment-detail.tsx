"use client";

import {
  Briefcase,
  Coins,
  Euro,
  Receipt,
  ShoppingBasket,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { formatTrend, trendDelta } from "./evolution-badge";
import { PdbDelta7dTable } from "./pdb-delta-7d-table";
import type { CompareRow } from "./establishments-compare-table";

const iconClass = "h-4 w-4 text-muted-foreground";

/** Sous-titre d'évolution : « +12,5% vs période précédente » ou undefined. */
function evolutionSubtitle(
  current: number,
  prev: number | null
): string | undefined {
  if (prev === null) return undefined;
  const { pct } = trendDelta(current, prev);
  if (pct === null) return "— vs période précédente";
  return `${formatTrend(pct)} vs période précédente`;
}

export function EstablishmentDetail({
  row,
  periodLabel,
}: {
  row: CompareRow;
  /** Libellé humain de la période affichée (formatPeriodLabel). */
  periodLabel: string;
}) {
  const prev = row.prev;
  const basketCents =
    row.sales_count > 0
      ? Math.round((row.euro_cents + row.pdb_spent_cents) / row.sales_count)
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{row.establishment_title}</h2>
        <p className="text-sm text-muted-foreground">{periodLabel}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Chiffre d'affaires €"
          icon={<Euro className={iconClass} />}
          value={formatCurrency(row.euro_cents)}
          subtitle={evolutionSubtitle(row.euro_cents, prev?.euro_cents ?? null)}
          info="Paiements en euros (carte + espèces) sur les tickets scannés Royaume de la période."
        />
        <StatCard
          title="Tickets"
          icon={<Receipt className={iconClass} />}
          value={row.sales_count.toLocaleString("fr-FR")}
          subtitle={evolutionSubtitle(row.sales_count, prev?.sales_count ?? null)}
        />
        <StatCard
          title="Panier moyen"
          icon={<ShoppingBasket className={iconClass} />}
          value={basketCents === null ? "—" : formatCurrency(basketCents)}
          info="(Euros + PdB dépensés) ÷ nombre de tickets sur la période."
        />
        <StatCard
          title="Nouveaux clients"
          icon={<UserPlus className={iconClass} />}
          value={row.new_clients.toLocaleString("fr-FR")}
          subtitle={evolutionSubtitle(row.new_clients, prev?.new_clients ?? null)}
          info="Clients dont le tout premier ticket dans CET établissement tombe dans la période (un client déjà connu ailleurs compte comme nouveau ici). Une période en cours se compare à la période précédente complète : l'évolution est mécaniquement sous-évaluée tant que la période n'est pas terminée."
        />
        <StatCard
          title="Clients actifs"
          icon={<Users className={iconClass} />}
          value={row.active_clients.toLocaleString("fr-FR")}
          subtitle={evolutionSubtitle(
            row.active_clients,
            prev?.active_clients ?? null
          )}
          info="Clients distincts ayant au moins un ticket sur la période."
        />
        <StatCard
          title="PdB générés"
          icon={<Coins className={iconClass} />}
          value={formatCurrency(row.pdb_generated_cents)}
          subtitle={evolutionSubtitle(
            row.pdb_generated_cents,
            prev?.pdb_generated_cents ?? null
          )}
          info="Paraiges de Bronze organiques gagnés sur les tickets de la période (1 PdB = 0,01 €)."
        />
        <StatCard
          title="PdB dépensés"
          icon={<Wallet className={iconClass} />}
          value={formatCurrency(row.pdb_spent_cents)}
          subtitle={evolutionSubtitle(
            row.pdb_spent_cents,
            prev?.pdb_spent_cents ?? null
          )}
          info="Paiements réglés en Paraiges de Bronze sur les tickets de la période."
        />
        <StatCard
          title="Salariés"
          icon={<Briefcase className={iconClass} />}
          value={row.employees_count}
          info="Effectif actuel rattaché à l'établissement (serveurs + managers), indépendant de la période."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Paiements PdB — Cashpad vs Royaume (7 derniers jours)
          </CardTitle>
          <CardDescription>
            Fenêtre glissante indépendante de la période sélectionnée. Seules
            les journées fiscales avec au moins un ticket Royaume apparaissent ;
            « cal. » = journée sans clôture Cashpad (fallback calendaire).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PdbDelta7dTable daily={row.pdbDelta7d?.daily ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
