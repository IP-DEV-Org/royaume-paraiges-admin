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
import { Loader2, Receipt, TrendingUp, CreditCard, Banknote, Ticket } from "lucide-react";
import {
  getReceipts,
  getReceiptStats,
  type ReceiptFilters,
  type ReceiptWithDetails,
} from "@/lib/services/receiptService";
import { getEstablishments, type Establishment } from "@/lib/services/contentService";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const paymentMethodLabels: Record<string, string> = {
  card: "Carte",
  cash: "Espèces",
  cashback: "Cashback",
  coupon: "Coupon",
};

const paymentMethodIcons: Record<string, React.ReactNode> = {
  card: <CreditCard className="h-4 w-4" />,
  cash: <Banknote className="h-4 w-4" />,
  cashback: <TrendingUp className="h-4 w-4" />,
  coupon: <Ticket className="h-4 w-4" />,
};

const consumptionTypeLabels: Record<string, string> = {
  cocktail: "Cocktail",
  biere: "Bière",
  alcool: "Alcool",
  soft: "Soft",
  boisson_chaude: "Boisson chaude",
  restauration: "Restauration",
};

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<ReceiptWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<ReceiptFilters>({});
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tickets de caisse</h1>
        <p className="text-muted-foreground">
          Visualisation des transactions clients
        </p>
      </div>

      {stats && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total tickets
                </CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalReceipts}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CA total</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(stats.totalRevenue)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Panier moyen</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(Math.round(stats.averageAmount))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  CA ce mois
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(stats.revenueThisMonth)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.receiptsThisMonth} tickets
                </p>
              </CardContent>
            </Card>
          </div>

          {stats.paymentMethodBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Répartition par moyen de paiement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  {stats.paymentMethodBreakdown.map((item) => (
                    <div
                      key={item.method}
                      className="flex items-center gap-3 rounded-lg border p-4"
                    >
                      <div className="rounded-full bg-primary/10 p-2">
                        {paymentMethodIcons[item.method] || <Receipt className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {paymentMethodLabels[item.method] || item.method}
                        </p>
                        <p className="text-lg font-bold">
                          {formatCurrency(item.total)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.count} transaction{item.count > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Liste des tickets</CardTitle>
              <CardDescription>
                {total} ticket{total > 1 ? "s" : ""} au total
              </CardDescription>
            </div>
            <div className="w-full sm:w-64">
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
                <SelectTrigger>
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
                  {receipts.map((receipt) => (
                    <TableRow key={receipt.id}>
                      <TableCell className="font-mono text-sm">
                        #{receipt.id}
                      </TableCell>
                      <TableCell>
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
                        <Badge variant="default">
                          {formatCurrency(receipt.amount)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {receipt.receipt_lines && receipt.receipt_lines.length > 0 ? (
                            [...new Set(receipt.receipt_lines.map((line) => line.payment_method))].map(
                              (method) => (
                                <Badge
                                  key={method}
                                  variant="outline"
                                  className="flex items-center gap-1"
                                >
                                  {paymentMethodIcons[method]}
                                  {paymentMethodLabels[method] || method}
                                </Badge>
                              )
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
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
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
  );
}
