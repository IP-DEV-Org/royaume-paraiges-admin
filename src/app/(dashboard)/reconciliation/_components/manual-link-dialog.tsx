"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  findCashpadCandidates,
  getCashpadSnapshotsByIds,
  linkManually,
  type ReconciliationRow,
} from "@/lib/services/reconciliationService";
import { reconciliationKeys } from "@/lib/queries/keys";
import {
  deltaColorClass,
  formatDateTime,
  formatDelta,
  formatEuro,
  SkeletonRows,
} from "./shared";

// =============================================================================
// Modale de lien manuel : arbitrage des candidats ambigus, ou recherche d'un
// ticket Cashpad pour un orphelin avec fenêtre temporelle ajustable (5 → 120
// min par pas de 5). Le delta retenu est stocké côté service dans
// `manual_link_delta_seconds` pour le feedback loop de /reconciliation/health.
// =============================================================================

interface ManualLinkDialogProps {
  receipt: ReconciliationRow | null;
  onClose: () => void;
}

const WINDOW_STEP_MIN = 5;
const WINDOW_INITIAL_MIN = 5;
const WINDOW_MAX_MIN = 120;

export function ManualLinkDialog({ receipt, onClose }: ManualLinkDialogProps) {
  const queryClient = useQueryClient();
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [windowMinutes, setWindowMinutes] = useState(WINDOW_INITIAL_MIN);

  const open = receipt !== null;
  const isAmbiguous = receipt !== null && receipt.status === "ambiguous";
  const receiptId = receipt?.receipt.id ?? 0;
  const windowSeconds = windowMinutes * 60;

  const ambiguousIds =
    receipt !== null && receipt.status === "ambiguous"
      ? (receipt.candidates ?? []).map((c) => c.cashpad_receipt_id)
      : [];

  const ambiguousQuery = useQuery({
    queryKey: reconciliationKeys.candidatesByIds(ambiguousIds),
    queryFn: () => getCashpadSnapshotsByIds(ambiguousIds),
    enabled: open && isAmbiguous && ambiguousIds.length > 0,
    staleTime: 30_000,
  });

  const orphanQuery = useQuery({
    queryKey: reconciliationKeys.candidates(receiptId, windowSeconds),
    queryFn: () => findCashpadCandidates(receiptId, windowSeconds),
    enabled: open && !isAmbiguous,
    staleTime: 30_000,
  });

  const candidatesQuery = isAmbiguous ? ambiguousQuery : orphanQuery;

  const linkMutation = useMutation({
    mutationFn: () =>
      linkManually({
        receiptId,
        cashpadReceiptId: selectedSnapshotId!,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Receipt lié au ticket Cashpad");
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
      onClose();
    },
    onError: (err: Error) => {
      toast.error("Erreur lors du lien manuel", { description: err.message });
    },
  });

  const handleSubmit = () => {
    if (!selectedSnapshotId) return;
    linkMutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setSelectedSnapshotId(null);
          setNotes("");
          setWindowMinutes(WINDOW_INITIAL_MIN);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isAmbiguous
              ? "Arbitrer les candidats ambigus"
              : "Lien manuel avec un ticket Cashpad"}
          </DialogTitle>
          <DialogDescription>
            {isAmbiguous
              ? "Choisis le ticket Cashpad correct parmi les candidats détectés au matching."
              : "Recherche sur le même établissement et le même montant, fenêtre temporelle ajustable."}
          </DialogDescription>
        </DialogHeader>

        {receipt && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="font-medium">Receipt Royaume #{receipt.receipt.id}</div>
            <div className="text-muted-foreground">
              {formatDateTime(receipt.receipt.created_at)} · {formatEuro(receipt.receipt.amount)} ·{" "}
              {receipt.receipt.establishment?.title ?? "—"}
            </div>
          </div>
        )}

        {!isAmbiguous && (
          <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">
              Fenêtre temporelle
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setWindowMinutes((m) => Math.max(WINDOW_STEP_MIN, m - WINDOW_STEP_MIN))
                }
                disabled={windowMinutes <= WINDOW_STEP_MIN}
                className="h-7 w-7 p-0"
                aria-label="Réduire la fenêtre"
              >
                −
              </Button>
              <span className="min-w-16 text-center text-sm font-medium tabular-nums">
                ± {windowMinutes} min
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setWindowMinutes((m) => Math.min(WINDOW_MAX_MIN, m + WINDOW_STEP_MIN))
                }
                disabled={windowMinutes >= WINDOW_MAX_MIN}
                className="h-7 w-7 p-0"
                aria-label="Élargir la fenêtre"
              >
                +
              </Button>
            </div>
          </div>
        )}

        <div className="max-h-96 overflow-y-auto">
          {candidatesQuery.isLoading ? (
            <SkeletonRows rows={3} cols={4} />
          ) : candidatesQuery.data && candidatesQuery.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead>Heure Cashpad</TableHead>
                  <TableHead>Δ</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Serveur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidatesQuery.data.map((c) => {
                  const deltaS = receipt
                    ? Math.round(
                        (new Date(c.closed_at).getTime() -
                          new Date(receipt.receipt.created_at).getTime()) /
                          1000,
                      )
                    : null;
                  return (
                    <TableRow
                      key={c.cashpad_receipt_id}
                      className="cursor-pointer"
                      onClick={() => setSelectedSnapshotId(c.cashpad_receipt_id)}
                    >
                      <TableCell>
                        <input
                          type="radio"
                          checked={selectedSnapshotId === c.cashpad_receipt_id}
                          onChange={() => setSelectedSnapshotId(c.cashpad_receipt_id)}
                        />
                      </TableCell>
                      <TableCell>{formatDateTime(c.closed_at)}</TableCell>
                      <TableCell
                        className={`whitespace-nowrap text-xs font-medium tabular-nums ${deltaColorClass(deltaS)}`}
                      >
                        {formatDelta(deltaS)}
                      </TableCell>
                      <TableCell>{formatEuro(c.amount_cents)}</TableCell>
                      <TableCell>{c.cashpad_user_name ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-md border border-dashed">
              {isAmbiguous ? (
                <EmptyState
                  title="Aucun candidat enregistré pour ce receipt"
                  description="Données de matching incohérentes."
                  className="py-6"
                />
              ) : (
                <EmptyState
                  title={`Aucun ticket Cashpad trouvé sur ±${windowMinutes} min avec le même montant et établissement.`}
                  description={
                    windowMinutes < WINDOW_MAX_MIN
                      ? "Élargis la fenêtre avec +."
                      : undefined
                  }
                  className="py-6"
                />
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Note (optionnelle)
          </label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Pourquoi ce lien manuel ?"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedSnapshotId || linkMutation.isPending}
          >
            {linkMutation.isPending
              ? "Lien…"
              : isAmbiguous
                ? "Arbitrer"
                : "Lier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
