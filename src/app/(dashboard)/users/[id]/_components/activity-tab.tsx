"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownCircle,
  Loader2,
  PiggyBank,
  ShoppingCart,
  Target,
  Wallet,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/stat-card";
import {
  PeriodSelector,
  getPresetDates,
  type PeriodDates,
} from "@/components/period-selector";
import {
  getUserActivityStats,
  getUserDailyCashback,
  getUserQuestProgress,
} from "@/lib/services/userService";
import { userKeys } from "@/lib/queries/keys";
import { toast } from "sonner";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { TablePagination } from "./table-pagination";
import { USER_DETAIL_PAGE_SIZE } from "./types";

const questProgressBarColors: Record<string, string> = {
  in_progress: "bg-primary",
  completed: "bg-amber-500",
  rewarded: "bg-emerald-500",
  expired: "bg-red-500",
};

export function ActivityTab({ userId }: { userId: string }) {
  const [activityPeriod, setActivityPeriod] = useState<PeriodDates>(() => {
    const { start, end } = getPresetDates("all_time");
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  });
  const [questProgressPage, setQuestProgressPage] = useState(0);
  const [questPeriodTypeFilter, setQuestPeriodTypeFilter] = useState("all");
  const [questStatusFilter, setQuestStatusFilter] = useState("all");

  const activityQuery = useQuery({
    queryKey: [...userKeys.detail(userId), "activity", activityPeriod],
    queryFn: async () => {
      const [stats, daily] = await Promise.all([
        getUserActivityStats(userId, activityPeriod.startDate, activityPeriod.endDate),
        getUserDailyCashback(userId, activityPeriod.startDate, activityPeriod.endDate),
      ]);
      return { stats, daily };
    },
  });

  const questProgressQuery = useQuery({
    queryKey: [
      ...userKeys.detail(userId),
      "questProgress",
      {
        page: questProgressPage,
        periodType: questPeriodTypeFilter,
        status: questStatusFilter,
      },
    ],
    queryFn: () =>
      getUserQuestProgress(
        userId,
        USER_DETAIL_PAGE_SIZE,
        questProgressPage * USER_DETAIL_PAGE_SIZE,
        questPeriodTypeFilter !== "all" ? questPeriodTypeFilter : undefined,
        questStatusFilter !== "all" ? questStatusFilter : undefined
      ),
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (activityQuery.error) {
      console.error(activityQuery.error);
      toast.error("Erreur", {
        description: "Impossible de charger les statistiques d'activité",
      });
    }
  }, [activityQuery.error]);

  useEffect(() => {
    if (questProgressQuery.error) {
      console.error(questProgressQuery.error);
      toast.error("Erreur", {
        description: "Impossible de charger la progression des quêtes",
      });
    }
  }, [questProgressQuery.error]);

  const activityStats = activityQuery.data?.stats ?? null;
  const dailyCashback = activityQuery.data?.daily ?? [];
  const questProgress = questProgressQuery.data?.data ?? [];
  const questProgressTotal = questProgressQuery.data?.count ?? 0;
  const questProgressPages = Math.ceil(questProgressTotal / USER_DETAIL_PAGE_SIZE);
  const hasQuestFilters =
    questPeriodTypeFilter !== "all" || questStatusFilter !== "all";

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h2 className="hidden text-lg font-semibold sm:block">Activité</h2>
        <PeriodSelector defaultPreset="all_time" onPeriodChange={setActivityPeriod} />
      </div>

      {activityQuery.isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : activityStats ? (
        <>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <StatCard
              title="Commandes"
              icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />}
              value={activityStats.ordersCount}
            />
            <StatCard
              title="Dépensé (EUR)"
              icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
              value={formatCurrency(activityStats.totalSpentEuros)}
            />
            <StatCard
              title="XP Gagné"
              icon={<Zap className="h-4 w-4 text-muted-foreground" />}
              value={activityStats.xpEarned.toLocaleString()}
            />
            <StatCard
              title="Cashback Gagné"
              icon={<PiggyBank className="h-4 w-4 text-muted-foreground" />}
              value={formatCurrency(activityStats.cashbackEarned)}
              subtitle={`${formatCurrency(activityStats.cashbackEarnedOrganic)} organique · ${formatCurrency(activityStats.cashbackEarnedRewards)} récompenses`}
            />
            <StatCard
              title="Cashback Dépensé"
              icon={<ArrowDownCircle className="h-4 w-4 text-muted-foreground" />}
              value={formatCurrency(activityStats.cashbackSpent)}
            />
          </div>

          {dailyCashback.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cashback gagné vs dépensé</CardTitle>
                <CardDescription>Évolution sur la période sélectionnée</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyCashback}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) => {
                        const d = new Date(v);
                        return `${d.getDate()}/${d.getMonth() + 1}`;
                      }}
                      className="text-xs"
                    />
                    <YAxis
                      tickFormatter={(v: number) => `${(v / 100).toFixed(0)}€`}
                      className="text-xs"
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = {
                          earnedOrganic: "Gagné (organique)",
                          earnedRewards: "Gagné (récompenses)",
                          spent: "Dépensé",
                        };
                        return [formatCurrency(value), labels[name] || name];
                      }}
                      labelFormatter={(label: string) => {
                        const d = new Date(label);
                        return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
                      }}
                    />
                    <Legend
                      formatter={(value: string) => {
                        const labels: Record<string, string> = {
                          earnedOrganic: "Organique",
                          earnedRewards: "Récompenses",
                          spent: "Dépensé",
                        };
                        return labels[value] || value;
                      }}
                    />
                    <Bar dataKey="earnedOrganic" stackId="earned" fill="#16a34a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="earnedRewards" stackId="earned" fill="#4ade80" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="spent" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      {/* Progression des quêtes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Quêtes
              </CardTitle>
              <CardDescription>
                {questProgressTotal} quête{questProgressTotal > 1 ? "s" : ""} au total
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select
                value={questPeriodTypeFilter}
                onValueChange={(value) => {
                  setQuestPeriodTypeFilter(value);
                  setQuestProgressPage(0);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="weekly">Hebdomadaire</SelectItem>
                  <SelectItem value="monthly">Mensuelle</SelectItem>
                  <SelectItem value="yearly">Annuelle</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={questStatusFilter}
                onValueChange={(value) => {
                  setQuestStatusFilter(value);
                  setQuestProgressPage(0);
                }}
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="completed">Complétée</SelectItem>
                  <SelectItem value="rewarded">Récompensée</SelectItem>
                  <SelectItem value="expired">Expirée</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {questProgressQuery.isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : questProgress.length === 0 ? (
            <EmptyState
              icon={Target}
              title={
                hasQuestFilters
                  ? "Aucun résultat pour cette recherche"
                  : "Aucune quête pour cet utilisateur"
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quête</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Progression</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Complétée le</TableHead>
                    <TableHead>Mise à jour</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questProgress.map((qp) => {
                    const pct = qp.target_value > 0
                      ? Math.min(Math.round((qp.current_value / qp.target_value) * 100), 100)
                      : 0;
                    const questType = qp.quest?.quest_type;
                    const isAmountSpent = questType === "amount_spent";
                    const currentDisplay = isAmountSpent
                      ? formatCurrency(qp.current_value)
                      : qp.current_value.toLocaleString();
                    const targetDisplay = isAmountSpent
                      ? formatCurrency(qp.target_value)
                      : qp.target_value.toLocaleString();
                    const unitLabel = !isAmountSpent
                      ? questType === "xp_earned" ? " XP"
                        : questType === "cashback_earned" ? " PdB"
                        : questType === "establishments_visited" ? " établ."
                        : questType === "orders_count" ? " cmd" : ""
                      : "";

                    return (
                      <TableRow key={qp.id}>
                        <TableCell>
                          {qp.quest ? (
                            <Link
                              href={`/quests/${qp.quest.id}`}
                              className="font-medium hover:underline"
                            >
                              {qp.quest.name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">Quête #{qp.quest_id}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{qp.period_identifier}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-24 shrink-0">
                              <div className="h-2 w-full rounded-full bg-muted">
                                <div
                                  className={`h-2 rounded-full transition-all ${questProgressBarColors[qp.status] || "bg-primary"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-sm whitespace-nowrap">
                              {currentDisplay}/{targetDisplay}{unitLabel} ({pct}%)
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={qp.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {qp.completed_at ? formatDateTime(qp.completed_at) : (
                            <span>&mdash;</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(qp.updated_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <TablePagination
                page={questProgressPage}
                pageCount={questProgressPages}
                onPageChange={setQuestProgressPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
