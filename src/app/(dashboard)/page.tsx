"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Receipt,
  Coins,
  Users,
  Award,
  Ticket,
  Target,
  Trophy,
  Wallet,
  Activity,
} from "lucide-react";
import {
  getDashboardAlerts,
  getDashboardActivity,
  getDashboardGameState,
  getDashboardFinancialHealth,
} from "@/lib/services/dashboardOverviewService";
import { dashboardKeys } from "@/lib/queries/keys";
import { formatCurrency, cn } from "@/lib/utils";

// ============================================================================
// Section 1 — Alertes
// ============================================================================

interface AlertItem {
  label: string;
  count: number;
  href: string;
  hint?: string;
}

function AlertsSection() {
  const { data, isLoading } = useQuery({
    queryKey: dashboardKeys.alerts(),
    queryFn: getDashboardAlerts,
    staleTime: 60_000,
  });

  if (isLoading) {
    return <SkeletonCard rows={2} />;
  }
  if (!data) return null;

  const alerts: AlertItem[] = [
    {
      label: "Orphelins Cashpad (7j)",
      count: data.orphans7d,
      href: "/reconciliation",
      hint: "Receipts Royaume sans ticket Cashpad correspondant",
    },
    {
      label: "Tickets Cashpad annulés détectés",
      count: data.cancelledMatch7d,
      href: "/reconciliation",
      hint: "Scan client sur ticket annulé — à investiguer",
    },
    {
      label: "Distributions leaderboard en attente",
      count: data.pendingDistributions,
      href: "/rewards/distribute",
    },
    {
      label: "Établissements en dérive d'horloge",
      count: data.clockDriftEstablishments,
      href: "/reconciliation/health",
      hint: "Décalage > 30s vs Cashpad",
    },
  ].filter((a) => a.count > 0);

  if (alerts.length === 0) {
    return (
      <Card className="border-emerald-500/40 bg-emerald-500/5">
        <CardContent className="flex items-center gap-3 py-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="font-medium">Tout va bien</p>
            <p className="text-sm text-muted-foreground">
              Pas d&apos;alerte sur les 7 derniers jours.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          {alerts.length} alerte{alerts.length > 1 ? "s" : ""} à traiter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((alert) => (
          <Link
            key={alert.label}
            href={alert.href}
            className="flex items-center justify-between rounded-md border bg-background px-3 py-2 transition-colors hover:bg-accent"
          >
            <div>
              <p className="text-sm font-medium">{alert.label}</p>
              {alert.hint && (
                <p className="text-xs text-muted-foreground">{alert.hint}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="destructive">{alert.count}</Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Section 2 — Activité 7j
// ============================================================================

interface ActivityKpi {
  label: string;
  icon: typeof Receipt;
  current: number;
  previous: number;
  format: (n: number) => string;
  href?: string;
}

function trendDelta(current: number, previous: number): {
  pct: number | null;
  direction: "up" | "down" | "flat";
} {
  if (previous === 0) {
    if (current === 0) return { pct: null, direction: "flat" };
    return { pct: null, direction: "up" };
  }
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  if (Math.abs(pct) < 0.5) return { pct: 0, direction: "flat" };
  return { pct, direction: pct > 0 ? "up" : "down" };
}

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  const { pct, direction } = trendDelta(current, previous);
  const Icon =
    direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  const color =
    direction === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : direction === "down"
        ? "text-rose-600 dark:text-rose-400"
        : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", color)}>
      <Icon className="h-3 w-3" />
      {pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct}%`}
    </span>
  );
}

function ActivitySection() {
  const { data, isLoading } = useQuery({
    queryKey: dashboardKeys.activity(),
    queryFn: getDashboardActivity,
    staleTime: 5 * 60_000,
  });

  const kpis: ActivityKpi[] = data
    ? [
        {
          label: "Tickets de caisse",
          icon: Receipt,
          current: data.current.tickets,
          previous: data.previous.tickets,
          format: (n) => n.toLocaleString("fr-FR"),
          href: "/receipts",
        },
        {
          label: "CA tickets",
          icon: Wallet,
          current: data.current.ticketsAmount,
          previous: data.previous.ticketsAmount,
          format: formatCurrency,
        },
        {
          label: "PdB gagnées",
          icon: Coins,
          current: data.current.cashbackEarned,
          previous: data.previous.cashbackEarned,
          format: formatCurrency,
        },
        {
          label: "PdB dépensées",
          icon: Coins,
          current: data.current.cashbackSpent,
          previous: data.previous.cashbackSpent,
          format: formatCurrency,
        },
        {
          label: "Coupons distribués",
          icon: Ticket,
          current: data.current.couponsDistributed,
          previous: data.previous.couponsDistributed,
          format: (n) => n.toLocaleString("fr-FR"),
          href: "/history",
        },
        {
          label: "Nouveaux inscrits",
          icon: Users,
          current: data.current.newUsers,
          previous: data.previous.newUsers,
          format: (n) => n.toLocaleString("fr-FR"),
          href: "/users",
        },
        {
          label: "Badges décernés",
          icon: Award,
          current: data.current.badgesAwarded,
          previous: data.previous.badgesAwarded,
          format: (n) => n.toLocaleString("fr-FR"),
        },
      ]
    : [];

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Activité (7 derniers jours)"
        subtitle="Variation vs les 7 jours précédents"
      />
      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} rows={2} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <ActivityKpiCard key={kpi.label} kpi={kpi} />
          ))}
        </div>
      )}
    </section>
  );
}

function ActivityKpiCard({ kpi }: { kpi: ActivityKpi }) {
  const body = (
    <Card className={kpi.href ? "transition-colors hover:bg-accent" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
        <kpi.icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{kpi.format(kpi.current)}</div>
        <TrendBadge current={kpi.current} previous={kpi.previous} />
      </CardContent>
    </Card>
  );
  return kpi.href ? <Link href={kpi.href}>{body}</Link> : body;
}

// ============================================================================
// Section 3 — État du jeu
// ============================================================================

function GameStateSection() {
  const { data, isLoading } = useQuery({
    queryKey: dashboardKeys.gameState(),
    queryFn: getDashboardGameState,
    staleTime: 5 * 60_000,
  });

  return (
    <section className="space-y-3">
      <SectionHeader title="État du jeu" subtitle="Quêtes & engagement de la semaine en cours" />
      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard rows={4} />
          <SkeletonCard rows={4} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                Quêtes en cours
              </CardTitle>
              <CardDescription>
                {data.weeklyActiveQuestsCount} quête
                {data.weeklyActiveQuestsCount > 1 ? "s" : ""} hebdomadaire
                {data.weeklyActiveQuestsCount > 1 ? "s" : ""} active
                {data.weeklyActiveQuestsCount > 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Engagement
                  </p>
                  <p className="text-2xl font-bold">{data.engagementRate}%</p>
                  <p className="text-xs text-muted-foreground">
                    des clients ont validé ≥ 1 quête cette semaine
                  </p>
                </div>
                {data.topQuestsThisWeek.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                      Top 3 quêtes
                    </p>
                    <ul className="space-y-1.5">
                      {data.topQuestsThisWeek.map((q, i) => (
                        <li
                          key={q.questId}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="truncate">
                            <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                            {q.title}
                          </span>
                          <Badge variant="secondary">{q.completions}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                Prochaine distribution
              </CardTitle>
              <CardDescription>
                Leaderboard à distribuer aux gagnants
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.nextDistribution ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Période
                    </p>
                    <p className="text-2xl font-bold">
                      {data.nextDistribution.periodIdentifier}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {labelPeriod(data.nextDistribution.periodType)}
                    </p>
                  </div>
                  <Link href="/rewards/distribute">
                    <Button variant="outline" size="sm" className="w-full justify-between">
                      Distribuer
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucune distribution en attente.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Section 4 — Santé financière
// ============================================================================

function FinancialHealthSection() {
  const { data, isLoading } = useQuery({
    queryKey: dashboardKeys.financialHealth(),
    queryFn: getDashboardFinancialHealth,
    staleTime: 5 * 60_000,
  });

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Santé financière"
        subtitle="Dette PdB et flux sur 7 jours"
      />
      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} rows={2} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Dette PdB en circulation
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.pdbDebt)}</div>
              <p className="text-xs text-muted-foreground">
                Somme des soldes utilisateurs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Flux net 7j</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "text-2xl font-bold",
                  data.pdbNetFlow7d > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : data.pdbNetFlow7d < 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "",
                )}
              >
                {data.pdbNetFlow7d > 0 ? "+" : ""}
                {formatCurrency(data.pdbNetFlow7d)}
              </div>
              <p className="text-xs text-muted-foreground">
                Gagné − dépensé (positif = dette en hausse)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Part PdB dans le CA
              </CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.pdbShareOfRevenue7d}%</div>
              <p className="text-xs text-muted-foreground">
                Taux de redemption sur 7j
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function SkeletonCard({ rows }: { rows: number }) {
  return (
    <Card>
      <CardContent className="space-y-2 py-6">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-4 animate-pulse rounded bg-muted",
              i === 0 ? "w-1/2" : "w-3/4",
            )}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function labelPeriod(periodType: string): string {
  if (periodType === "weekly") return "Hebdomadaire";
  if (periodType === "monthly") return "Mensuelle";
  if (periodType === "yearly") return "Annuelle";
  return periodType;
}

// ============================================================================
// Page
// ============================================================================

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Pilotage du Royaume — alertes, activité, état du jeu, santé financière
        </p>
      </div>

      <AlertsSection />
      <ActivitySection />
      <GameStateSection />
      <FinancialHealthSection />
    </div>
  );
}
