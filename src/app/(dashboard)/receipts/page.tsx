"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Receipt,
  TrendingUp,
} from "lucide-react";
import {
  getReceipts,
  getReceiptStats,
  type ReceiptFilters,
  type ReceiptWithDetails,
} from "@/lib/services/receiptService";
import { getEstablishments, type Establishment } from "@/lib/services/contentService";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { getPaymentMethodConfig } from "@/lib/payment-methods";
import type { ReconciliationStatus } from "@/types/database";

function startOfCurrentMonthIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
import { useToast } from "@/components/ui/use-toast";

const consumptionTypeLabels: Record<string, string> = {
  cocktail: "Cocktail",
  biere: "Bière",
  alcool: "Alcool",
  soft: "Soft",
  boisson_chaude: "Boisson chaude",
  restauration: "Restauration",
};

function ReconciliationBadge({ status }: { status: ReconciliationStatus }) {
  if (status === "matched") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Réconcilié
      </Badge>
    );
  }
  if (status === "orphan_royaume") {
    return (
      <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400">
        <AlertTriangle className="mr-1 h-3 w-3" />
        Orphelin
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

function ReceiptDetailsDialog({
  receipt,
  establishmentName,
  onClose,
}: {
  receipt: ReceiptWithDetails | null;
  establishmentName: string;
  onClose: () => void;
}) {
  const open = receipt !== null;
  if (!receipt) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent />
      </Dialog>
    );
  }
  const reconciliation = receipt.cashpad_reconciliation ?? null;
  const snap = reconciliation?.cashpad_snapshot ?? null;
  const customerLabel = receipt.customer
    ? `${receipt.customer.first_name || ""} ${
        receipt.customer.last_name || ""
      }`.trim() || receipt.customer.email
    : "Inconnu";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Ticket #{receipt.id}
            {reconciliation && <ReconciliationBadge status={reconciliation.status} />}
          </DialogTitle>
          <DialogDescription>
            {formatDateTime(receipt.created_at)} · {establishmentName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Ticket Royaume
            </h3>
            <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/20 p-3 text-sm">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Client
                </div>
                <Link
                  href={`/users/${receipt.customer_id}`}
                  className="hover:underline"
                >
                  {customerLabel}
                </Link>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Montant
                </div>
                <div className="tabular-nums">{formatCurrency(receipt.amount)}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Paiement
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {receipt.receipt_lines && receipt.receipt_lines.length > 0 ? (
                    receipt.receipt_lines.map((line) => {
                      const config = getPaymentMethodConfig(line.payment_method);
                      return (
                        <Badge
                          key={line.id}
                          variant="outline"
                          className={cn("flex items-center gap-1", config.badgeClass)}
                        >
                          {config.icon}
                          {config.label} · {formatCurrency(line.amount)}
                        </Badge>
                      );
                    })
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              {receipt.receipt_consumption_items &&
                receipt.receipt_consumption_items.length > 0 && (
                  <div className="col-span-2">
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Consommations (saisies)
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {receipt.receipt_consumption_items.map((item) => (
                        <Badge key={item.id} variant="outline">
                          {item.quantity}x{" "}
                          {consumptionTypeLabels[item.consumption_type] ||
                            item.consumption_type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </section>

          {reconciliation ? (
            snap ? (
              <>
                <section className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Ticket Cashpad
                  </h3>
                  <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/20 p-3 text-sm">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Horodatage
                      </div>
                      <div>{formatDateTime(snap.closed_at)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Montant
                      </div>
                      <div className="tabular-nums">
                        {formatCurrency(snap.amount_cents)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Serveur
                      </div>
                      <div>{snap.cashpad_user_name ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Sequential ID
                      </div>
                      <div>{snap.cashpad_sequential_id ?? "—"}</div>
                    </div>
                    {reconciliation.confidence_score !== null && (
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Confiance
                        </div>
                        <div className="tabular-nums">
                          {reconciliation.confidence_score}%
                        </div>
                      </div>
                    )}
                    {reconciliation.manually_linked_at && (
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Lien manuel
                        </div>
                        <div>{formatDate(reconciliation.manually_linked_at)}</div>
                      </div>
                    )}
                  </div>
                </section>

                {snap.products && snap.products.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Produits Cashpad ({snap.products.length})
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
                                {formatCurrency(p.qty > 0 ? p.price_cents / p.qty : p.price_cents)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrency(p.price_cents)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                )}
              </>
            ) : (
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Ticket Cashpad
                </h3>
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  {reconciliation.status === "orphan_royaume"
                    ? "Aucun ticket Cashpad trouvé pour ce receipt (orphan)."
                    : reconciliation.status === "excluded_cashback"
                      ? "Paiement 100% PdB — hors scope Cashpad."
                      : reconciliation.status === "ambiguous"
                        ? "Plusieurs candidats Cashpad — arbitrage manuel nécessaire."
                        : "Pas de ticket Cashpad associé."}
                </div>
              </section>
            )
          ) : (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Ticket Cashpad
              </h3>
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Réconciliation non encore exécutée pour ce ticket.
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<ReceiptWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<ReceiptFilters>({});
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptWithDetails | null>(
    null
  );
  const [stats, setStats] = useState<{
    totalReceipts: number;
    totalRevenue: number;
    averageAmount: number;
    receiptsThisMonth: number;
    revenueThisMonth: number;
    paymentMethodBreakdown: { method: string; total: number; count: number }[];
  } | null>(null);
  const { toast } = useToast();

  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [receiptsResult, statsResult, establishmentsResult] = await Promise.all([
        getReceipts(filters, limit, page * limit),
        getReceiptStats(),
        getEstablishments(),
      ]);
      setReceipts(receiptsResult.data);
      setTotal(receiptsResult.count);
      setStats(statsResult);
      setEstablishments(establishmentsResult);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les tickets de caisse",
      });
    } finally {
      setLoading(false);
    }
  }, [filters, page, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getEstablishmentName = (id: number) => {
    const establishment = establishments.find((e) => e.id === id);
    return establishment?.title || `Établissement #${id}`;
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Tickets de caisse</h1>
        <p className="text-muted-foreground">
          Visualisation des transactions clients
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 md:flex-row">
        <aside className="space-y-6 md:h-full md:w-80 md:shrink-0 md:overflow-y-auto md:pr-1">
          {stats && (
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-foreground">
                Activité
              </h2>
              <div className="space-y-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                    <CardTitle className="text-xs font-medium text-muted-foreground">
                      Total tickets
                    </CardTitle>
                    <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="text-xl font-bold">{stats.totalReceipts}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                    <CardTitle className="text-xs font-medium text-muted-foreground">
                      CA total
                    </CardTitle>
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="text-xl font-bold">
                      {formatCurrency(stats.totalRevenue)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                    <CardTitle className="text-xs font-medium text-muted-foreground">
                      Panier moyen
                    </CardTitle>
                    <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="text-xl font-bold">
                      {formatCurrency(Math.round(stats.averageAmount))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>
          )}

          {stats && (
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-foreground">
                Ce mois
              </h2>
              <Card
                onClick={() => {
                  setPage(0);
                  setFilters((prev) => ({
                    ...prev,
                    dateFrom: prev.dateFrom ? undefined : startOfCurrentMonthIso(),
                  }));
                }}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-accent",
                  filters.dateFrom && "border-primary bg-primary/5 hover:bg-primary/10"
                )}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    CA ce mois
                  </CardTitle>
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="text-xl font-bold">
                    {formatCurrency(stats.revenueThisMonth)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats.receiptsThisMonth} ticket{stats.receiptsThisMonth > 1 ? "s" : ""}
                  </p>
                </CardContent>
              </Card>
            </section>
          )}

          {stats && stats.paymentMethodBreakdown.length > 0 && (
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-foreground">
                Paiements
              </h2>
              <div className="space-y-2">
                {stats.paymentMethodBreakdown.map((item) => {
                  const isActive = filters.paymentMethod === item.method;
                  const config = getPaymentMethodConfig(item.method);
                  return (
                    <Card
                      key={item.method}
                      onClick={() => {
                        setPage(0);
                        setFilters((prev) => ({
                          ...prev,
                          paymentMethod:
                            prev.paymentMethod === item.method ? undefined : item.method,
                        }));
                      }}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-accent",
                        isActive && "border-primary bg-primary/5 hover:bg-primary/10"
                      )}
                    >
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                        <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <span className={cn("h-2 w-2 rounded-full", config.dotClass)} />
                          {config.label}
                        </CardTitle>
                        <span className={config.iconColor}>{config.icon}</span>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <div className="text-xl font-bold">{formatCurrency(item.total)}</div>
                        <p className="text-xs text-muted-foreground">
                          {item.count} transaction{item.count > 1 ? "s" : ""}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-foreground">
              Filtres
            </h2>
            <Select
              value={filters.establishmentId?.toString() || "all"}
              onValueChange={(value) => {
                setPage(0);
                setFilters({
                  ...filters,
                  establishmentId: value === "all" ? undefined : parseInt(value),
                });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filtrer par établissement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les établissements</SelectItem>
                {establishments.map((establishment) => (
                  <SelectItem
                    key={establishment.id}
                    value={establishment.id.toString()}
                  >
                    {establishment.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>
        </aside>

        <Card className="flex min-h-0 flex-1 flex-col md:h-full md:overflow-hidden">
          <CardHeader>
            <CardTitle>Liste des tickets</CardTitle>
            <CardDescription>
              {total} ticket{total > 1 ? "s" : ""} au total
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col md:overflow-hidden">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : receipts.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Aucun ticket trouvé
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 md:overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Établissement</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Paiement</TableHead>
                      <TableHead>Consommations</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {receipts.map((receipt) => {
                    const dominantMethod =
                      receipt.receipt_lines && receipt.receipt_lines.length > 0
                        ? receipt.receipt_lines.reduce((max, line) =>
                            line.amount > max.amount ? line : max
                          ).payment_method
                        : null;
                    const amountConfig = dominantMethod
                      ? getPaymentMethodConfig(dominantMethod)
                      : null;
                    const reconciliation = receipt.cashpad_reconciliation ?? null;
                    return (
                    <TableRow
                      key={receipt.id}
                      onClick={() => setSelectedReceipt(receipt)}
                      className="cursor-pointer hover:bg-muted/40"
                    >
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          #{receipt.id}
                          {reconciliation && (
                            <ReconciliationBadge status={reconciliation.status} />
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div>
                          <Link
                            href={`/users/${receipt.customer_id}`}
                            className="font-medium hover:underline"
                          >
                            {receipt.customer
                              ? `${receipt.customer.first_name || ""} ${
                                  receipt.customer.last_name || ""
                                }`.trim() || receipt.customer.email
                              : "Inconnu"}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {receipt.customer?.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getEstablishmentName(receipt.establishment_id)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-semibold",
                            amountConfig?.badgeClass
                          )}
                        >
                          {formatCurrency(receipt.amount)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {receipt.receipt_lines && receipt.receipt_lines.length > 0 ? (
                            [...new Set(receipt.receipt_lines.map((line) => line.payment_method))].map(
                              (method) => {
                                const config = getPaymentMethodConfig(method);
                                return (
                                  <Badge
                                    key={method}
                                    variant="outline"
                                    className={cn("flex items-center gap-1", config.badgeClass)}
                                  >
                                    {config.icon}
                                    {config.label}
                                  </Badge>
                                );
                              }
                            )
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {receipt.receipt_consumption_items && receipt.receipt_consumption_items.length > 0 ? (
                            receipt.receipt_consumption_items.map((item) => (
                              <Badge key={item.id} variant="outline">
                                {item.quantity}x {consumptionTypeLabels[item.consumption_type] || item.consumption_type}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(receipt.created_at)}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex shrink-0 items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page + 1} sur {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage(page - 1)}
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage(page + 1)}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      </div>

      <ReceiptDetailsDialog
        receipt={selectedReceipt}
        establishmentName={
          selectedReceipt
            ? getEstablishmentName(selectedReceipt.establishment_id)
            : ""
        }
        onClose={() => setSelectedReceipt(null)}
      />
    </div>
  );
}
