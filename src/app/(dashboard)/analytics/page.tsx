"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ShoppingCart,
  Euro,
  Coins,
  TrendingUp,
  TrendingDown,
  Trophy,
  Percent,
  Ticket,
  Info,
  ChevronsUpDown,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import {
  getAnalyticsRevenue,
  getAnalyticsDebts,
  getAnalyticsStock,
  getEstablishmentsWithTicketCount,
  getEmployeesWithTicketCount,
  getDailyCashbackStats,
  getDailyRevenueStats,
  type RevenueData,
  type DebtsData,
  type StockData,
  type DailyCashback,
  type DailyRevenue,
  type DrilldownMetric,
} from "@/lib/services/analyticsService";
import { cn, formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { PeriodSelector, getPresetDates, type PeriodDates } from "@/components/period-selector";
import { DrilldownModal } from "@/components/analytics-drilldown-modal";
import { StatCard } from "@/components/stat-card";
import { RevenueChartCard } from "@/components/analytics/revenue-chart-card";
import { DebtsDonutCard } from "@/components/analytics/debts-donut-card";
import { CashbackChartCard } from "@/components/analytics/cashback-chart-card";
import { StockDetailCard } from "@/components/analytics/stock-detail-card";

export default function AnalyticsPage() {
  // Filters
  const [periodDates, setPeriodDates] = useState<PeriodDates>(() => {
    const { start, end } = getPresetDates("all_time");
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  });
  const [establishmentId, setEstablishmentId] = useState<number | undefined>();
  const [employeeId, setEmployeeId] = useState<string | undefined>();

  // Reference data
  const [establishments, setEstablishments] = useState<{ id: number; title: string; ticketCount: number }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string; ticketCount: number }[]>([]);

  // Data
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [debts, setDebts] = useState<DebtsData | null>(null);
  const [stock, setStock] = useState<StockData | null>(null);
  const [dailyCashback, setDailyCashback] = useState<DailyCashback[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [estOpen, setEstOpen] = useState(false);
  const [empOpen, setEmpOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const { toast } = useToast();

  // Drilldown
  const [drilldownMetric, setDrilldownMetric] = useState<DrilldownMetric | null>(null);
  const [drilldownTitle, setDrilldownTitle] = useState("");
  const [drilldownOpen, setDrilldownOpen] = useState(false);

  const openDrilldown = (metric: DrilldownMetric, title: string) => {
    setDrilldownMetric(metric);
    setDrilldownTitle(title);
    setDrilldownOpen(true);
  };

  // Track previous dates to avoid duplicate fetches on mount
  const prevDatesRef = useRef<string>("");

  // Load establishments with ticket count when period changes
  useEffect(() => {
    getEstablishmentsWithTicketCount(periodDates.startDate, periodDates.endDate).then(setEstablishments);
  }, [periodDates.startDate, periodDates.endDate]);

  // Load employees when establishment or period changes
  useEffect(() => {
    setEmployeeId(undefined);
    getEmployeesWithTicketCount(establishmentId, periodDates.startDate, periodDates.endDate).then(setEmployees);
  }, [establishmentId, periodDates.startDate, periodDates.endDate]);

  // Fetch analytics data
  const fetchData = useCallback(
    async (dates: PeriodDates) => {
      setLoading(true);
      try {
        const filters = { startDate: dates.startDate, endDate: dates.endDate, establishmentId, employeeId };

        const [rev, dbt, stk, daily, dailyRev] = await Promise.all([
          getAnalyticsRevenue(filters),
          getAnalyticsDebts(filters),
          getAnalyticsStock({ startDate: dates.startDate, endDate: dates.endDate, establishmentId }),
          getDailyCashbackStats(dates.startDate, dates.endDate),
          getDailyRevenueStats(dates.startDate, dates.endDate),
        ]);

        setRevenue(rev);
        setDebts(dbt);
        setStock(stk);
        setDailyCashback(daily);
        setDailyRevenue(dailyRev);
      } catch {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de charger les statistiques",
        });
      } finally {
        setLoading(false);
      }
    },
    [establishmentId, employeeId, toast]
  );

  useEffect(() => {
    const key = `${periodDates.startDate}|${periodDates.endDate}|${establishmentId}|${employeeId}`;
    if (key === prevDatesRef.current) return;
    prevDatesRef.current = key;
    fetchData(periodDates);
  }, [periodDates, establishmentId, employeeId, fetchData]);

  const hasFilter = !!(establishmentId || employeeId);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Recettes, dettes et stock de Paraiges de Bronze — uniquement les transactions enregistrées via le Royaume
        </p>
      </div>

      {/* Filters - sticky under title */}
      <div className="sticky -top-4 z-10 -mx-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3 sm:-top-6 sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3 sm:gap-3">
          {/* Mobile: Filters toggle button */}
          <Button
            variant="outline"
            size="sm"
            className="order-1 sm:hidden"
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filtres
            {hasFilter && (
              <span className="ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {(establishmentId ? 1 : 0) + (employeeId ? 1 : 0)}
              </span>
            )}
          </Button>

          {/* Period selector - always visible */}
          <div className="order-2 ml-auto sm:order-last sm:ml-0">
            <PeriodSelector
              defaultPreset="all_time"
              onPeriodChange={setPeriodDates}
            />
          </div>

          {/* Combobox filters - collapsible on mobile, always inline on desktop */}
          <div className={cn(
            "order-3 flex w-full flex-col gap-2 sm:order-first sm:w-auto sm:flex-1 sm:flex-row sm:items-center sm:gap-3",
            !mobileFiltersOpen && "hidden sm:flex"
          )}>
            <Popover open={estOpen} onOpenChange={setEstOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={estOpen}
                  className="w-full justify-between font-normal sm:w-auto sm:min-w-[350px]"
                >
                  {establishmentId
                    ? (() => {
                        const est = establishments.find((e) => e.id === establishmentId);
                        return est ? `${est.title} (${est.ticketCount})` : "Tous les établissements";
                      })()
                    : "Tous les établissements"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="min-w-[350px] p-0" side="bottom">
                <Command>
                  <CommandInput placeholder="Rechercher..." />
                  <CommandList>
                    <CommandEmpty>Aucun résultat.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="tous les établissements"
                        onSelect={() => {
                          setEstablishmentId(undefined);
                          setEstOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", !establishmentId ? "opacity-100" : "opacity-0")} />
                        Tous les établissements
                      </CommandItem>
                      {establishments.map((e) => (
                        <CommandItem
                          key={e.id}
                          value={e.title}
                          onSelect={() => {
                            setEstablishmentId(e.id);
                            setEstOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", establishmentId === e.id ? "opacity-100" : "opacity-0")} />
                          <span className="flex-1">{e.title}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{e.ticketCount} ticket{e.ticketCount !== 1 ? "s" : ""}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Popover open={empOpen} onOpenChange={setEmpOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={empOpen}
                  className="w-full justify-between font-normal sm:w-auto sm:min-w-[350px]"
                >
                  {employeeId
                    ? (() => {
                        const emp = employees.find((e) => e.id === employeeId);
                        return emp ? `${emp.name} (${emp.ticketCount})` : "Tous les employés";
                      })()
                    : "Tous les employés"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="min-w-[350px] p-0" side="bottom">
                <Command>
                  <CommandInput placeholder="Rechercher..." />
                  <CommandList>
                    <CommandEmpty>Aucun résultat.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="tous les employés"
                        onSelect={() => {
                          setEmployeeId(undefined);
                          setEmpOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", !employeeId ? "opacity-100" : "opacity-0")} />
                        Tous les employés
                      </CommandItem>
                      {employees.map((e) => (
                        <CommandItem
                          key={e.id}
                          value={e.name}
                          onSelect={() => {
                            setEmployeeId(e.id);
                            setEmpOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", employeeId === e.id ? "opacity-100" : "opacity-0")} />
                          <span className="flex-1">{e.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{e.ticketCount} ticket{e.ticketCount !== 1 ? "s" : ""}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {/* ==================== RECETTES ==================== */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Recettes</h2>
            <div className="grid gap-4 lg:grid-cols-[1fr_3fr]">
              <div className="flex flex-col gap-4 [&>*]:flex-1">
                <StatCard
                  title="Ventes Royaume enregistrées"
                  icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />}
                  value={revenue?.salesCount ?? 0}
                  subtitle="Scannées via le Royaume"
                  info="Nombre de tickets enregistrés via le scan QR Royaume sur la période. Source : table receipts, hors utilisateurs test."
                  onClick={() => openDrilldown("receipts", "Ventes enregistrées")}
                />
                <StatCard
                  title="Recettes enregistrées"
                  icon={<Euro className="h-4 w-4 text-muted-foreground" />}
                  value={formatCurrency(revenue?.totalEuros ?? 0)}
                  subtitle={`Carte : ${formatCurrency(revenue?.cardTotal ?? 0)} / Espèces : ${formatCurrency(revenue?.cashTotal ?? 0)}`}
                  info="Total des paiements carte + espèces enregistrés via le Royaume. Source : receipt_lines agrégées par méthode de paiement. N'inclut pas les paiements hors Royaume."
                  onClick={() => openDrilldown("receipts", "Recettes enregistrées")}
                />
                <StatCard
                  title="PdB dépensés"
                  icon={<Coins className="h-4 w-4 text-bronze" />}
                  value={formatCurrency(revenue?.cashbackSpentTotal ?? 0)}
                  subtitle="Utilisés sur les commandes Royaume"
                  info="PdB utilisés comme moyen de paiement sur les commandes. Source : receipt_lines où la méthode de paiement est cashback."
                  onClick={() => openDrilldown("spendings", "PdB dépensés")}
                />
              </div>

              <RevenueChartCard data={dailyRevenue} />
            </div>
          </section>

          <hr className="-mx-4 border-border sm:-mx-6" />

          {/* ==================== DETTES ==================== */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Dettes</h2>

            {hasFilter && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-accent p-3 text-sm text-accent-foreground">
                <Info className="h-4 w-4 shrink-0 text-bronze" />
                <span>
                  Les PdB Récompenses ne sont pas filtrables par établissement ou employé.
                  Seuls les PdB Organiques sont filtrés.
                </span>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-4 grid-cols-2">
                <StatCard
                  title="PdB Organiques"
                  icon={<TrendingUp className="h-4 w-4 text-bronze" />}
                  value={formatCurrency(debts?.pdbOrganic ?? 0)}
                  subtitle="Dépenses euros"
                  info="PdB gagnés sur les dépenses en euros (cashback classique). Source : table gains où source_type = receipt. Filtrable par établissement/employé."
                  onClick={() => openDrilldown("gainsOrganic", "PdB Organiques")}
                />
                <StatCard
                  title="PdB Récompenses"
                  icon={<Trophy className="h-4 w-4 text-gold" />}
                  value={formatCurrency(debts?.pdbRewards ?? 0)}
                  subtitle="Quêtes et classement"
                  info="PdB gagnés via quêtes et classement leaderboard. Source : table gains où source_type = bonus_cashback_quest ou bonus_cashback_leaderboard. Toujours global, non filtrable par établissement/employé."
                  onClick={() => openDrilldown("gainsRewards", "PdB Récompenses")}
                />
                <StatCard
                  title="Coupons % actifs"
                  icon={<Ticket className="h-4 w-4 text-muted-foreground" />}
                  value={debts?.activePctCouponsCount ?? 0}
                  subtitle="Non utilisés, non expirés"
                  info="Nombre de coupons à pourcentage non utilisés et non expirés. Source : table coupons (used = false, percentage non null). Toujours global."
                  onClick={() => openDrilldown("couponsActive", "Coupons % actifs")}
                />
                <StatCard
                  title="Total dettes PdB"
                  icon={<Coins className="h-4 w-4 text-muted-foreground" />}
                  value={formatCurrency(debts?.pdbTotal ?? 0)}
                  subtitle="Sur la période"
                  info="Somme de tous les PdB crédités sur la période : organiques + récompenses + bonus coupons. Source : RPC get_analytics_debts."
                  onClick={() => openDrilldown("gainsAll", "Total dettes PdB")}
                />
              </div>

              {debts && <DebtsDonutCard debts={debts} />}
            </div>
          </section>

          <hr className="-mx-4 border-border sm:-mx-6" />

          {/* ==================== CASHBACK & STOCK PdB ==================== */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Cashback & Stock PdB</h2>

            {stock?.hasFilter && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-accent p-3 text-sm text-accent-foreground">
                <Info className="h-4 w-4 shrink-0 text-bronze" />
                <span>
                  Filtre par établissement actif : seuls les PdB Organiques sont pris en compte.
                </span>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
              <div className="flex flex-col gap-4 [&>*]:flex-1">
                <StatCard
                  title="Stock PdB début de période"
                  icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
                  value={formatCurrency(stock?.opening.total ?? 0)}
                  subtitle="Début de période"
                  info="Total des PdB en circulation au début de la période. Calcul : somme des gains − somme des dépenses, avant la date de début."
                />
                <StatCard
                  title="Stock PdB fin de période"
                  icon={<Coins className="h-4 w-4 text-bronze" />}
                  value={formatCurrency(stock?.closing.total ?? 0)}
                  subtitle="Fin de période"
                  info="Total des PdB en circulation à la fin de la période. Calcul : somme des gains − somme des dépenses, avant la date de fin."
                />
                {(() => {
                  const netMovement =
                    (stock?.movements.earnedOrganic ?? 0) +
                    (stock?.movements.earnedRewards ?? 0) -
                    (stock?.movements.spent ?? 0);
                  return (
                    <StatCard
                      title="Mouvements PdB nets"
                      icon={
                        netMovement >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )
                      }
                      value={`${netMovement >= 0 ? "+" : ""}${formatCurrency(netMovement)}`}
                      valueClassName={netMovement >= 0 ? "text-green-600" : "text-red-600"}
                      subtitle="Gagnés - Dépensés"
                      info="Variation nette des PdB sur la période. Calcul : (PdB organiques gagnés + PdB récompenses gagnés) − PdB dépensés."
                    />
                  );
                })()}
                {(() => {
                  const eurosSpent = revenue?.totalEuros ?? 0;
                  const cashbackEarned = debts?.pdbTotal ?? 0;
                  const ratio = eurosSpent > 0 ? (cashbackEarned / eurosSpent) * 100 : null;
                  return (
                    <StatCard
                      title="Ratio € dépensés / PdB remportés"
                      icon={<Percent className="h-4 w-4 text-muted-foreground" />}
                      value={ratio !== null ? `${ratio.toFixed(1)}%` : "—"}
                      subtitle={
                        ratio !== null
                          ? `${formatCurrency(cashbackEarned)} de PdB pour ${formatCurrency(eurosSpent)} dépensés`
                          : "Aucune dépense sur la période"
                      }
                      info="Ratio entre les PdB totaux crédités et les euros enregistrés via le Royaume. Calcul : (total dettes PdB ÷ recettes enregistrées) × 100."
                    />
                  );
                })()}
              </div>

              <div className="flex flex-col gap-4">
                <CashbackChartCard data={dailyCashback} />
                {stock && <StockDetailCard stock={stock} />}
              </div>
            </div>
          </section>
        </div>
      )}

      <DrilldownModal
        open={drilldownOpen}
        onOpenChange={setDrilldownOpen}
        metric={drilldownMetric}
        title={drilldownTitle}
        filters={{
          startDate: periodDates.startDate,
          endDate: periodDates.endDate,
          establishmentId,
          employeeId,
        }}
      />
    </div>
  );
}
