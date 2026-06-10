"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { ReconciliationRow } from "@/lib/services/reconciliationService";
import {
  ConfidenceCell,
  deltaColorClass,
  Field,
  formatDateTime,
  formatDelta,
  formatEuro,
  getCustomerLabel,
} from "./shared";

// =============================================================================
// Modale de détails d'une réconciliation : receipt Royaume + ticket Cashpad
// côte à côte, score de confiance, produits, candidats si ambigu, alerte
// cancelled_match, traçabilité du lien manuel.
// =============================================================================

interface ReconciliationDetailsDialogProps {
  row: ReconciliationRow | null;
  onClose: () => void;
  onRequestLink: (row: ReconciliationRow) => void;
}

export function ReconciliationDetailsDialog({
  row,
  onClose,
  onRequestLink,
}: ReconciliationDetailsDialogProps) {
  const open = row !== null;
  if (!row) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent />
      </Dialog>
    );
  }
  const snap = row.cashpad_snapshot;
  const customerLabel = getCustomerLabel(row.receipt.customer);
  const canLink = row.status === "orphan_royaume" || row.status === "ambiguous";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StatusBadge status={row.status} />
            <span>Receipt Royaume #{row.receipt.id}</span>
            {row.confidence_score !== null && (
              <span className="ml-auto flex items-center gap-2 text-xs font-normal text-muted-foreground">
                Confiance
                <ConfidenceCell score={row.confidence_score} />
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Réconcilié le {formatDateTime(row.reconciled_at)}
            {row.cancelled_match_id && (
              <span className="ml-2 inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                · ⚠ un ticket Cashpad annulé aurait matché — investiguer
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Receipt Royaume
            </h3>
            <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/20 p-3">
              <Field label="Horodatage">{formatDateTime(row.receipt.created_at)}</Field>
              <Field label="Montant">{formatEuro(row.receipt.amount)}</Field>
              <Field label="Établissement">
                {row.receipt.establishment?.title ?? "—"}
              </Field>
              <Field label="Client">{customerLabel}</Field>
            </div>
          </section>

          {snap ? (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Ticket Cashpad
                {row.status === "ambiguous" && (
                  <span className="ml-2 font-normal normal-case text-muted-foreground">
                    (meilleur candidat)
                  </span>
                )}
              </h3>
              <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/20 p-3">
                <Field label="Horodatage">{formatDateTime(snap.closed_at)}</Field>
                <Field label="Δ temporel">
                  <span
                    className={`tabular-nums ${deltaColorClass(row.time_delta_seconds)}`}
                  >
                    {formatDelta(row.time_delta_seconds)}
                  </span>
                </Field>
                <Field label="Montant">{formatEuro(snap.amount_cents)}</Field>
                <Field label="Serveur">{snap.cashpad_user_name ?? "—"}</Field>
                <Field label="Sequential ID">
                  {snap.cashpad_sequential_id ?? "—"}
                </Field>
                <Field label="Installation">
                  <span className="font-mono text-xs">{snap.installation_id}</span>
                </Field>
              </div>
            </section>
          ) : (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Ticket Cashpad
              </h3>
              <div className="rounded-md border border-dashed">
                <EmptyState
                  title="Aucun ticket Cashpad trouvé dans la fenêtre ±5 min."
                  className="py-4"
                />
              </div>
            </section>
          )}

          {snap?.products && snap.products.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Produits ({snap.products.length})
              </h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Qté</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead className="text-right">PU</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snap.products.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="tabular-nums">{p.qty}</TableCell>
                        <TableCell>{p.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.category ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatEuro(p.qty > 0 ? p.price_cents / p.qty : p.price_cents)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatEuro(p.price_cents)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          {row.candidates && row.candidates.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Candidats ({row.candidates.length})
              </h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cashpad receipt</TableHead>
                      <TableHead>Δ</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {row.candidates.map((c) => (
                      <TableRow key={c.cashpad_receipt_id}>
                        <TableCell className="font-mono text-xs">
                          {c.cashpad_receipt_id.slice(0, 8)}…
                        </TableCell>
                        <TableCell
                          className={`tabular-nums ${deltaColorClass(c.time_delta_seconds)}`}
                        >
                          {formatDelta(c.time_delta_seconds)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatEuro(c.amount_cents)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          {row.manually_linked_at && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Lien manuel
              </h3>
              <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/20 p-3">
                <Field label="Date">{formatDateTime(row.manually_linked_at)}</Field>
                <Field label="Admin">
                  <span className="font-mono text-xs">
                    {row.manually_linked_by ?? "—"}
                  </span>
                </Field>
                {row.notes && (
                  <div className="col-span-2">
                    <Field label="Note">{row.notes}</Field>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <DialogFooter>
          {canLink && (
            <Button
              onClick={() => {
                onRequestLink(row);
                onClose();
              }}
            >
              <Search className="mr-1 h-4 w-4" aria-hidden="true" />
              {row.status === "orphan_royaume" ? "Chercher un match" : "Arbitrer"}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
