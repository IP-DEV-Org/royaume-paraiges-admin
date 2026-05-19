"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Infinity as InfinityIcon,
  RefreshCw,
  Scale,
  Search,
  Square,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";
import { getEstablishments } from "@/lib/services/contentService";
import {
  listReconciliations,
  triggerReconciliationProgressive,
  findCashpadCandidates,
  getCashpadSnapshotsByIds,
  linkManually,
  getFirstRoyaumeReceiptDate,
  type ReconciliationRow,
  type ReconcileProgress,
} from "@/lib/services/reconciliationService";
import { reconciliationKeys, establishmentKeys } from "@/lib/queries/keys";

function yesterdayUtcISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function todayUtcISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type PeriodMode = "day" | "week" | "month";

// ── Conversions entre date YYYY-MM-DD et formats d'input HTML5 ──
function dateToWeekValue(dateISO: string): string {
  // Format ISO week "YYYY-Www" — calculé sur le jeudi de la semaine.
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function weekValueToDate(weekValue: string): string {
  // "YYYY-Www" → date du lundi de la semaine ISO.
  const match = weekValue.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return todayUtcISO();
  const year = parseInt(match[1] ?? "", 10);
  const week = parseInt(match[2] ?? "", 10);
  if (!year || !week) return todayUtcISO();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

function dateToMonthValue(dateISO: string): string {
  return dateISO.slice(0, 7);
}

function monthValueToDate(monthValue: string): string {
  return `${monthValue}-01`;
}

/** Décale la date d'une unité (jour / semaine / mois) dans une direction donnée. */
function shiftPeriod(dateISO: string, mode: PeriodMode, dir: -1 | 1): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  if (mode === "day") {
    d.setUTCDate(d.getUTCDate() + dir);
  } else if (mode === "week") {
    d.setUTCDate(d.getUTCDate() + dir * 7);
  } else {
    d.setUTCMonth(d.getUTCMonth() + dir);
  }
  return d.toISOString().slice(0, 10);
}

/** True si la période contenant `dateISO` inclut today (donc next doit être disabled). */
function isPeriodAtMax(dateISO: string, mode: PeriodMode): boolean {
  const today = todayUtcISO();
  if (mode === "day") return dateISO >= today;
  if (mode === "week") return dateToWeekValue(dateISO) >= dateToWeekValue(today);
  return dateToMonthValue(dateISO) >= dateToMonthValue(today);
}

/** Ouvre la modale native du picker au clic n'importe où sur l'input. */
function openPickerOnClick(e: React.MouseEvent<HTMLInputElement>) {
  const input = e.currentTarget as HTMLInputElement & {
    showPicker?: () => void;
  };
  input.showPicker?.();
}

function getPeriodBounds(
  mode: PeriodMode,
  dateISO: string,
): { startDate: string; endDate: string } {
  if (mode === "day") {
    return { startDate: dateISO, endDate: dateISO };
  }
  const d = new Date(`${dateISO}T00:00:00Z`);
  if (mode === "week") {
    // Lundi → dimanche (ISO). getUTCDay() : 0=dim, 1=lun, ... 6=sam
    const dow = d.getUTCDay();
    const offsetToMonday = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() + offsetToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
      startDate: monday.toISOString().slice(0, 10),
      endDate: sunday.toISOString().slice(0, 10),
    };
  }
  // month — 1er → dernier jour du mois civil
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return {
    startDate: first.toISOString().slice(0, 10),
    endDate: last.toISOString().slice(0, 10),
  };
}

function formatPeriodLabel(
  mode: PeriodMode,
  startDate: string,
  endDate: string,
): string {
  if (mode === "day") return new Date(`${startDate}T00:00:00Z`).toLocaleDateString("fr-FR");
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
    });
  if (mode === "month") {
    return new Date(`${startDate}T00:00:00Z`).toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });
  }
  return `${fmt(startDate)} → ${fmt(endDate)}`;
}

function formatEuro(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return `${(cents / 100).toFixed(2)} €`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTimeOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function DateTimeCell({ iso }: { iso: string | null | undefined }) {
  if (!iso) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="leading-tight">
      <div className="text-sm">{formatDateOnly(iso)}</div>
      <div className="text-xs text-muted-foreground tabular-nums">{formatTimeOnly(iso)}</div>
    </div>
  );
}

function formatDelta(seconds: number | null): string {
  if (seconds === null) return "—";
  const sign = seconds > 0 ? "+" : seconds < 0 ? "−" : "";
  const abs = Math.abs(seconds);
  if (abs < 60) return `${sign}${abs}s`;
  return `${sign}${Math.floor(abs / 60)}m ${abs % 60}s`;
}

function deltaColorClass(seconds: number | null): string {
  if (seconds === null) return "text-muted-foreground";
  const abs = Math.abs(seconds);
  if (abs <= 30) return "text-emerald-600 dark:text-emerald-400";
  if (abs <= 120) return "text-foreground";
  return "text-amber-600 dark:text-amber-400";
}

function ConfidenceCell({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  const color =
    score >= 80
      ? "bg-emerald-500"
      : score >= 50
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs tabular-nums">{score}</span>
    </div>
  );
}

// ============================================================================
// Helpers partagés modal/tables
// ============================================================================

function getCustomerLabel(
  customer: ReconciliationRow["receipt"]["customer"] | null | undefined,
): string {
  if (!customer) return "—";
  return (
    `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() ||
    customer.email ||
    customer.id.slice(0, 8)
  );
}

function StatusBadge({ status }: { status: ReconciliationRow["status"] }) {
  if (status === "matched") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Matché
      </Badge>
    );
  }
  if (status === "orphan_royaume") {
    return (
      <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400">
        <AlertTriangle className="mr-1 h-3 w-3" />
        Orphelin Royaume
      </Badge>
    );
  }
  if (status === "excluded_cashback") {
    return (
      <Badge className="bg-slate-500/15 text-slate-700 hover:bg-slate-500/20 dark:text-slate-300">
        100% PdB
      </Badge>
    );
  }
  return (
    <Badge className="bg-violet-500/15 text-violet-700 hover:bg-violet-500/20 dark:text-violet-400">
      <HelpCircle className="mr-1 h-3 w-3" />
      Ambigu
    </Badge>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

// ============================================================================
// Details dialog
// ============================================================================

interface ReconciliationDetailsDialogProps {
  row: ReconciliationRow | null;
  onClose: () => void;
  onRequestLink: (row: ReconciliationRow) => void;
}

function ReconciliationDetailsDialog({
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
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Aucun ticket Cashpad trouvé dans la fenêtre ±5 min.
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
                          {formatEuro(p.price_cents)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatEuro(p.price_cents * p.qty)}
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
              <Search className="mr-1 h-4 w-4" />
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

// ============================================================================
// Manual link dialog
// ============================================================================

interface ManualLinkDialogProps {
  receipt: ReconciliationRow | null;
  onClose: () => void;
}

const WINDOW_STEP_MIN = 5;
const WINDOW_INITIAL_MIN = 5;
const WINDOW_MAX_MIN = 120;

function ManualLinkDialog({ receipt, onClose }: ManualLinkDialogProps) {
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
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              {isAmbiguous
                ? "Aucun candidat enregistré pour ce receipt — données de matching incohérentes."
                : (
                  <>
                    Aucun ticket Cashpad trouvé sur ±{windowMinutes} min avec le même montant et établissement.
                    {windowMinutes < WINDOW_MAX_MIN && " Élargis la fenêtre avec +."}
                  </>
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

// ============================================================================
// Loading skeletons
// ============================================================================

function SkeletonRows({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-8 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ))}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-16 animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Receipt → snapshot detail row (for matched)
// ============================================================================

function MatchedRow({
  row,
  onSelect,
}: {
  row: ReconciliationRow;
  onSelect: (row: ReconciliationRow) => void;
}) {
  const snap = row.cashpad_snapshot;
  const customerLabel = getCustomerLabel(row.receipt.customer);

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => onSelect(row)}
    >
      <TableCell className="font-mono text-xs">#{row.receipt.id}</TableCell>
      <TableCell className="whitespace-nowrap">
        <DateTimeCell iso={row.receipt.created_at} />
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <DateTimeCell iso={snap?.closed_at} />
      </TableCell>
      <TableCell
        className={`whitespace-nowrap text-xs font-medium tabular-nums ${deltaColorClass(row.time_delta_seconds)}`}
      >
        {formatDelta(row.time_delta_seconds)}
      </TableCell>
      <TableCell>
        <ConfidenceCell score={row.confidence_score} />
      </TableCell>
      <TableCell>{formatEuro(row.receipt.amount)}</TableCell>
      <TableCell className="text-sm">{row.receipt.establishment?.title ?? "—"}</TableCell>
      <TableCell className="text-sm">{customerLabel}</TableCell>
      <TableCell className="text-sm">{snap?.cashpad_user_name ?? "—"}</TableCell>
    </TableRow>
  );
}

// ============================================================================
// Main page
// ============================================================================

type StatusFilter = "matched" | "orphan_royaume" | "ambiguous" | "excluded_cashback" | null;

export default function ReconciliationPage() {
  const queryClient = useQueryClient();
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [date, setDate] = useState(todayUtcISO());
  const [establishmentId, setEstablishmentId] = useState<string>("all");
  const [linkingReceipt, setLinkingReceipt] = useState<ReconciliationRow | null>(null);
  const [detailRow, setDetailRow] = useState<ReconciliationRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);

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
    const confirmMsg = `Lancer la réconciliation globale ${firstDate} → ${lastDate} (${days} jours) ?\n\nTous les établissements seront traités, indépendamment du filtre. Cela peut prendre plusieurs minutes.`;
    if (!window.confirm(confirmMsg)) return;
    await runReconciliation(firstDate, lastDate, { ignoreEstablishment: true });
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const percent =
    progress && progress.daysTotal > 0
      ? Math.round((progress.daysProcessed / progress.daysTotal) * 100)
      : 0;

  const rows = reconciliationsQuery.data ?? [];
  const matched = rows.filter((r) => r.status === "matched");
  const orphans = rows.filter((r) => r.status === "orphan_royaume");
  const ambiguous = rows.filter((r) => r.status === "ambiguous");
  const excludedCashback = rows.filter((r) => r.status === "excluded_cashback");

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Réconciliation Cashpad</h1>
          <p className="text-muted-foreground">
            Recoupe chaque receipt Royaume avec son ticket Cashpad. Les receipts sans match côté
            caisse sont des anomalies à investiguer.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/reconciliation/health">Santé du matching →</Link>
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 md:flex-row">
        <aside className="space-y-6 md:h-full md:w-80 md:shrink-0 md:overflow-y-auto md:pr-1">
          <section className="space-y-2">
            <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-foreground">
              Filtres
            </h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Période</label>
                <div className="flex gap-1 rounded-md border bg-muted/30 p-1">
                  {(["day", "week", "month"] as PeriodMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPeriodMode(m)}
                      className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                        periodMode === m
                          ? "bg-background shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m === "day" ? "Jour" : m === "week" ? "Semaine" : "Mois"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {periodMode === "day" ? "Date" : periodMode === "week" ? "Semaine" : "Mois"}
                </label>
                <div className="flex items-stretch gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setDate(shiftPeriod(date, periodMode, -1))}
                    aria-label="Période précédente"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {periodMode === "day" && (
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => e.target.value && setDate(e.target.value)}
                      onClick={openPickerOnClick}
                      max={todayUtcISO()}
                      className="w-full cursor-pointer"
                    />
                  )}
                  {periodMode === "week" && (
                    <Input
                      type="week"
                      value={dateToWeekValue(date)}
                      onChange={(e) =>
                        e.target.value && setDate(weekValueToDate(e.target.value))
                      }
                      onClick={openPickerOnClick}
                      max={dateToWeekValue(todayUtcISO())}
                      className="w-full cursor-pointer"
                    />
                  )}
                  {periodMode === "month" && (
                    <Input
                      type="month"
                      value={dateToMonthValue(date)}
                      onChange={(e) =>
                        e.target.value && setDate(monthValueToDate(e.target.value))
                      }
                      onClick={openPickerOnClick}
                      max={dateToMonthValue(todayUtcISO())}
                      className="w-full cursor-pointer"
                    />
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setDate(shiftPeriod(date, periodMode, 1))}
                    disabled={isPeriodAtMax(date, periodMode)}
                    aria-label="Période suivante"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
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
              {isRunning ? (
                <Button
                  onClick={handleStop}
                  variant="destructive"
                  className="w-full"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stopper
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button onClick={handleRun} className="w-full">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Relancer sur la période
                  </Button>
                  <Button
                    onClick={handleRunAll}
                    variant="outline"
                    className="w-full"
                  >
                    <InfinityIcon className="mr-2 h-4 w-4" />
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
                    icon={<Scale className="h-4 w-4 text-muted-foreground" />}
                    value={rows.length}
                    onClick={statusFilter ? () => setStatusFilter(null) : undefined}
                    subtitle={statusFilter ? "Cliquer pour tout afficher" : undefined}
                  />
                  <StatCard
                    title="Matchés"
                    icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    value={matched.length}
                    valueClassName="text-emerald-600 dark:text-emerald-400"
                    onClick={() => toggleStatusFilter("matched")}
                    active={statusFilter === "matched"}
                  />
                  <StatCard
                    title="Orphelins Royaume"
                    icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
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
                    icon={<HelpCircle className="h-4 w-4 text-violet-500" />}
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
                      icon={<Scale className="h-4 w-4 text-slate-500" />}
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Orphelins Royaume ({orphans.length})
          </CardTitle>
          <CardDescription>
            Receipts enregistrés dans l&apos;app mais sans ticket Cashpad correspondant dans la fenêtre
            ±5 min. Anomalies à investiguer (un paiement sans passage en caisse ?).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reconciliationsQuery.isLoading || isRunning ? (
            <SkeletonRows rows={4} cols={5} />
          ) : orphans.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aucun orphelin. Tous les receipts Royaume ont un ticket Cashpad correspondant.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Horodatage</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Établissement</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Signal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orphans.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setDetailRow(r)}
                  >
                    <TableCell className="font-mono text-xs">#{r.receipt.id}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <DateTimeCell iso={r.receipt.created_at} />
                    </TableCell>
                    <TableCell>{formatEuro(r.receipt.amount)}</TableCell>
                    <TableCell className="text-sm">
                      {r.receipt.establishment?.title ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {getCustomerLabel(r.receipt.customer)}
                    </TableCell>
                    <TableCell>
                      {r.cancelled_match_id && (
                        <Badge className="bg-rose-500/15 text-rose-700 hover:bg-rose-500/20 dark:text-rose-400">
                          Cashpad annulé
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      )}

      {/* Ambiguous */}
      {(statusFilter === null || statusFilter === "ambiguous") && ambiguous.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-violet-500" />
              Ambigus à arbitrer ({ambiguous.length})
            </CardTitle>
            <CardDescription>
              Plusieurs tickets Cashpad matchent dans la fenêtre. Le meilleur candidat (le plus proche
              dans le temps) est pré-sélectionné — confirme ou choisis-en un autre manuellement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Royaume</TableHead>
                  <TableHead>Cashpad (meilleur)</TableHead>
                  <TableHead>Δ</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Établissement</TableHead>
                  <TableHead>Candidats</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ambiguous.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setDetailRow(r)}
                  >
                    <TableCell className="font-mono text-xs">#{r.receipt.id}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <DateTimeCell iso={r.receipt.created_at} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <DateTimeCell iso={r.cashpad_snapshot?.closed_at} />
                    </TableCell>
                    <TableCell
                      className={`whitespace-nowrap text-xs font-medium tabular-nums ${deltaColorClass(r.time_delta_seconds)}`}
                    >
                      {formatDelta(r.time_delta_seconds)}
                    </TableCell>
                    <TableCell>{formatEuro(r.receipt.amount)}</TableCell>
                    <TableCell className="text-sm">
                      {r.receipt.establishment?.title ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{r.candidates?.length ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Matched */}
      {(statusFilter === null || statusFilter === "matched") && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Matchés ({matched.length})
          </CardTitle>
          <CardDescription>
            Receipts Royaume avec leur ticket Cashpad correspondant, enrichis du serveur et des
            produits vendus.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {reconciliationsQuery.isLoading || isRunning ? (
            <SkeletonRows rows={6} cols={6} />
          ) : matched.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aucun match. Lance une réconciliation pour cette date.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Royaume</TableHead>
                  <TableHead>Cashpad</TableHead>
                  <TableHead>Δ</TableHead>
                  <TableHead>Confiance</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Établissement</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Serveur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matched.map((r) => (
                  <MatchedRow key={r.id} row={r} onSelect={setDetailRow} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
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
    </div>
  );
}
