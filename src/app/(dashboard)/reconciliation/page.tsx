"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import {
  formatPeriodLabel,
  getPeriodBounds,
  PeriodDateNav,
  PeriodModeToggle,
  todayUtcISO,
  type PeriodMode,
} from "@/components/period-range";
import { getEstablishments } from "@/lib/services/contentService";
import {
  listReconciliations,
  triggerReconciliationProgressive,
  getFirstRoyaumeReceiptDate,
  type ReconciliationRow,
  type ReconcileProgress,
} from "@/lib/services/reconciliationService";
import { reconciliationKeys, establishmentKeys } from "@/lib/queries/keys";
import { StatCardSkeleton } from "./_components/shared";
import { ReconciliationDetailsDialog } from "./_components/details-dialog";
import { ManualLinkDialog } from "./_components/manual-link-dialog";
import { OrphansCard } from "./_components/orphans-card";
import { AmbiguousCard } from "./_components/ambiguous-card";
import { MatchedCard } from "./_components/matched-card";
import { RunControls } from "./_components/run-controls";

function yesterdayUtcISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

type StatusFilter = "matched" | "orphan_royaume" | "ambiguous" | "excluded_cashback" | null;

export default function ReconciliationPage() {
  const queryClient = useQueryClient();
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [date, setDate] = useState(todayUtcISO());
  const [establishmentId, setEstablishmentId] = useState<string>("all");
  const [linkingReceipt, setLinkingReceipt] = useState<ReconciliationRow | null>(null);
  const [detailRow, setDetailRow] = useState<ReconciliationRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [confirmGlobalOpen, setConfirmGlobalOpen] = useState(false);
  const [globalRunRange, setGlobalRunRange] = useState<{
    firstDate: string;
    lastDate: string;
    days: number;
  } | null>(null);

  const toggleStatusFilter = (status: NonNullable<StatusFilter>) => {
    setStatusFilter((prev) => (prev === status ? null : status));
  };

  const establishmentIdNum =
    establishmentId === "all" ? undefined : parseInt(establishmentId, 10);

  const { startDate, endDate } = useMemo(
    () => getPeriodBounds(periodMode, date),
    [periodMode, date],
  );

  const filters = useMemo(
    () => ({ startDate, endDate, establishmentId: establishmentIdNum }),
    [startDate, endDate, establishmentIdNum],
  );

  const reconciliationsQuery = useQuery({
    queryKey: reconciliationKeys.list(filters),
    queryFn: () => listReconciliations(filters),
  });

  const establishmentsQuery = useQuery({
    queryKey: establishmentKeys.lists(),
    queryFn: getEstablishments,
    staleTime: 5 * 60 * 1000,
  });

  const [progress, setProgress] = useState<ReconcileProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isRunning = progress !== null && !progress.done && !progress.aborted;

  const runReconciliation = async (
    runStart: string,
    runEnd: string,
    options: { ignoreEstablishment?: boolean } = {},
  ) => {
    abortRef.current = new AbortController();
    try {
      const final = await triggerReconciliationProgressive({
        startDate: runStart,
        endDate: runEnd,
        establishmentId: options.ignoreEstablishment ? undefined : establishmentIdNum,
        onProgress: (p) => setProgress(p),
        signal: abortRef.current.signal,
      });

      const head = final.aborted
        ? `Stoppé — ${final.daysProcessed}/${final.daysTotal} jours traités`
        : `Réconciliation terminée — ${final.daysProcessed} jour${final.daysProcessed > 1 ? "s" : ""}`;
      const body = `${final.matched} matchés · ${final.orphan_royaume} orphelins · ${final.ambiguous} ambigus`;
      if (final.aborted) toast.warning(head, { description: body });
      else toast.success(head, { description: body });

      queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Erreur de réconciliation", { description: msg });
    } finally {
      abortRef.current = null;
      // On garde l'état "done" pour afficher le résumé final, l'utilisateur
      // peut relancer en cliquant à nouveau.
      window.setTimeout(() => setProgress(null), 5_000);
    }
  };

  const handleRun = () => runReconciliation(startDate, endDate);

  const handleRunAll = async () => {
    let firstDate: string | null;
    try {
      firstDate = await getFirstRoyaumeReceiptDate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Impossible de récupérer la date du premier receipt", { description: msg });
      return;
    }
    if (!firstDate) {
      toast.warning("Aucun receipt Royaume sur un établissement Cashpad — rien à réconcilier.");
      return;
    }
    const lastDate = yesterdayUtcISO();
    if (firstDate > lastDate) {
      toast.warning("Premier receipt postérieur à hier — rien à traiter.");
      return;
    }
    const days = Math.floor(
      (new Date(`${lastDate}T00:00:00Z`).getTime() -
        new Date(`${firstDate}T00:00:00Z`).getTime()) /
        86_400_000,
    ) + 1;
    setGlobalRunRange({ firstDate, lastDate, days });
    setConfirmGlobalOpen(true);
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const rows = reconciliationsQuery.data ?? [];
  const matched = rows.filter((r) => r.status === "matched");
  const orphans = rows.filter((r) => r.status === "orphan_royaume");
  const ambiguous = rows.filter((r) => r.status === "ambiguous");
  const excludedCashback = rows.filter((r) => r.status === "excluded_cashback");

  return (
    <div className="flex h-full flex-col gap-6">
      <PageHeader
        title="Réconciliation Cashpad"
        description="Recoupe chaque receipt Royaume avec son ticket Cashpad. Les receipts sans match côté caisse sont des anomalies à investiguer."
        actions={
          <Button asChild variant="outline">
            <Link href="/reconciliation/health">Santé du matching →</Link>
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-6 md:flex-row">
        <aside className="space-y-6 md:h-full md:w-80 md:shrink-0 md:overflow-y-auto md:pr-1">
          <section className="space-y-2">
            <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-foreground">
              Filtres
            </h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Période</label>
                <PeriodModeToggle mode={periodMode} onModeChange={setPeriodMode} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {periodMode === "day" ? "Date" : periodMode === "week" ? "Semaine" : "Mois"}
                </label>
                <PeriodDateNav
                  mode={periodMode}
                  date={date}
                  onDateChange={setDate}
                  inputClassName="w-full cursor-pointer"
                />
                <p className="px-1 text-xs text-muted-foreground">
                  {formatPeriodLabel(periodMode, startDate, endDate)}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Établissement</label>
                <Select value={establishmentId} onValueChange={setEstablishmentId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les établissements</SelectItem>
                    {(establishmentsQuery.data ?? []).map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <RunControls
                isRunning={isRunning}
                progress={progress}
                onRun={handleRun}
                onRunAll={handleRunAll}
                onStop={handleStop}
              />
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-foreground">
              Aperçu
            </h2>
            <div className="space-y-2">
              {reconciliationsQuery.isLoading || isRunning ? (
                <>
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                </>
              ) : (
                <>
                  <StatCard
                    title="Receipts Royaume"
                    icon={<Scale className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                    value={rows.length}
                    onClick={statusFilter ? () => setStatusFilter(null) : undefined}
                    subtitle={statusFilter ? "Cliquer pour tout afficher" : undefined}
                  />
                  <StatCard
                    title="Matchés"
                    icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />}
                    value={matched.length}
                    valueClassName="text-emerald-600 dark:text-emerald-400"
                    onClick={() => toggleStatusFilter("matched")}
                    active={statusFilter === "matched"}
                  />
                  <StatCard
                    title="Orphelins Royaume"
                    icon={<AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />}
                    value={orphans.length}
                    subtitle="Anomalies à investiguer"
                    valueClassName={
                      orphans.length > 0 ? "text-amber-600 dark:text-amber-400" : undefined
                    }
                    onClick={() => toggleStatusFilter("orphan_royaume")}
                    active={statusFilter === "orphan_royaume"}
                  />
                  <StatCard
                    title="Ambigus"
                    icon={<HelpCircle className="h-4 w-4 text-violet-500" aria-hidden="true" />}
                    value={ambiguous.length}
                    subtitle="Plusieurs candidats à arbitrer"
                    valueClassName={
                      ambiguous.length > 0 ? "text-violet-600 dark:text-violet-400" : undefined
                    }
                    onClick={() => toggleStatusFilter("ambiguous")}
                    active={statusFilter === "ambiguous"}
                  />
                  {excludedCashback.length > 0 && (
                    <StatCard
                      title="100% PdB (exclus)"
                      icon={<Scale className="h-4 w-4 text-slate-500" aria-hidden="true" />}
                      value={excludedCashback.length}
                      subtitle="Paiements cashback, hors scope Cashpad"
                      onClick={() => toggleStatusFilter("excluded_cashback")}
                      active={statusFilter === "excluded_cashback"}
                    />
                  )}
                </>
              )}
            </div>
          </section>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col gap-6 md:h-full md:overflow-y-auto md:pr-1">
          {/* Orphans — prioritaire */}
          {(statusFilter === null || statusFilter === "orphan_royaume") && (
            <OrphansCard
              rows={orphans}
              loading={reconciliationsQuery.isLoading || isRunning}
              onSelect={setDetailRow}
            />
          )}

          {/* Ambiguous */}
          {(statusFilter === null || statusFilter === "ambiguous") && ambiguous.length > 0 && (
            <AmbiguousCard rows={ambiguous} onSelect={setDetailRow} />
          )}

          {/* Matched */}
          {(statusFilter === null || statusFilter === "matched") && (
            <MatchedCard
              rows={matched}
              loading={reconciliationsQuery.isLoading || isRunning}
              onSelect={setDetailRow}
            />
          )}
        </div>
      </div>

      <ReconciliationDetailsDialog
        row={detailRow}
        onClose={() => setDetailRow(null)}
        onRequestLink={(r) => setLinkingReceipt(r)}
      />

      <ManualLinkDialog
        receipt={linkingReceipt}
        onClose={() => setLinkingReceipt(null)}
      />

      <ConfirmDialog
        open={confirmGlobalOpen}
        onOpenChange={setConfirmGlobalOpen}
        title="Réconciliation globale"
        description={
          globalRunRange ? (
            <>
              <p>
                Lancer la réconciliation globale {globalRunRange.firstDate} →{" "}
                {globalRunRange.lastDate} ({globalRunRange.days} jours) ?
              </p>
              <p className="mt-2">
                Tous les établissements seront traités, indépendamment du filtre.
                Cela peut prendre plusieurs minutes.
              </p>
            </>
          ) : null
        }
        confirmLabel="Lancer"
        onConfirm={() => {
          if (!globalRunRange) return;
          void runReconciliation(globalRunRange.firstDate, globalRunRange.lastDate, {
            ignoreEstablishment: true,
          });
        }}
      />
    </div>
  );
}
