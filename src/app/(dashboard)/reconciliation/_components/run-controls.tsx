"use client";

import { Infinity as InfinityIcon, RefreshCw, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ReconcileProgress } from "@/lib/services/reconciliationService";

// =============================================================================
// Contrôle des runs de réconciliation : lancement sur la période / global,
// stop, et progress bar jour par jour pendant un run.
// =============================================================================

interface RunControlsProps {
  isRunning: boolean;
  progress: ReconcileProgress | null;
  onRun: () => void;
  onRunAll: () => void;
  onStop: () => void;
}

export function RunControls({
  isRunning,
  progress,
  onRun,
  onRunAll,
  onStop,
}: RunControlsProps) {
  const percent =
    progress && progress.daysTotal > 0
      ? Math.round((progress.daysProcessed / progress.daysTotal) * 100)
      : 0;

  return (
    <>
      {isRunning ? (
        <Button onClick={onStop} variant="destructive" className="w-full">
          <Square className="mr-2 h-4 w-4" aria-hidden="true" />
          Stopper
        </Button>
      ) : (
        <div className="space-y-2">
          <Button onClick={onRun} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Relancer sur la période
          </Button>
          <Button onClick={onRunAll} variant="outline" className="w-full">
            <InfinityIcon className="mr-2 h-4 w-4" aria-hidden="true" />
            Réconciliation globale
          </Button>
        </div>
      )}

      {progress && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {progress.daysProcessed} / {progress.daysTotal} jour
              {progress.daysTotal > 1 ? "s" : ""}
            </span>
            <span className="text-muted-foreground">{percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          {progress.currentDate && !progress.done && (
            <p className="text-muted-foreground">
              En cours : {progress.currentDate}
            </p>
          )}
          <div className="grid grid-cols-3 gap-1 pt-1 text-[10px]">
            <span className="text-emerald-600 dark:text-emerald-400">
              ✓ {progress.matched}
            </span>
            <span className="text-amber-600 dark:text-amber-400">
              ⚠ {progress.orphan_royaume}
            </span>
            <span className="text-violet-600 dark:text-violet-400">
              ? {progress.ambiguous}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Cashpad : {progress.cashpad_tickets_fetched} · Royaume :{" "}
            {progress.royaume_receipts}
          </p>
          {progress.errors.length > 0 && (
            <p className="text-[10px] text-destructive">
              {progress.errors.length} erreur
              {progress.errors.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </>
  );
}
