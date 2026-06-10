"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Receipt, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { getUserReceipts } from "@/lib/services/userService";
import { deleteReceipt } from "@/lib/services/receiptService";
import { userKeys } from "@/lib/queries/keys";
import { toast } from "sonner";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { getPaymentMethodConfig } from "@/lib/payment-methods";
import { TablePagination } from "./table-pagination";
import { USER_DETAIL_PAGE_SIZE } from "./types";

const consumptionTypeLabels: Record<string, string> = {
  cocktail: "Cocktail",
  biere: "Bière",
  alcool: "Alcool",
  soft: "Soft",
  boisson_chaude: "Boisson chaude",
  restauration: "Restauration",
};

export function ReceiptsTab({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [receiptsPage, setReceiptsPage] = useState(0);

  const receiptsQuery = useQuery({
    queryKey: [...userKeys.detail(userId), "receipts", { page: receiptsPage }],
    queryFn: () =>
      getUserReceipts(userId, USER_DETAIL_PAGE_SIZE, receiptsPage * USER_DETAIL_PAGE_SIZE),
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (receiptsQuery.error) {
      console.error(receiptsQuery.error);
      toast.error("Erreur", {
        description: "Impossible de charger les tickets",
      });
    }
  }, [receiptsQuery.error]);

  const receipts = receiptsQuery.data?.data ?? [];
  const receiptsTotal = receiptsQuery.data?.count ?? 0;
  const receiptsPages = Math.ceil(receiptsTotal / USER_DETAIL_PAGE_SIZE);

  // La RPC admin_delete_receipt rafraîchit la matview user_stats côté BDD :
  // l'invalidation de userKeys.all refetch donc des cartes d'en-tête à jour.
  const deleteMutation = useMutation({
    mutationFn: (receiptId: number) => deleteReceipt(receiptId),
    onSuccess: (_data, receiptId) => {
      toast.success("Ticket supprimé", {
        description: `Le ticket #${receiptId} et toutes ses données associées (gains, lignes de paiement, consommations, réconciliation) ont été supprimés.`,
      });
      // Si on supprime le dernier élément d'une page, recule d'une page.
      if (receipts.length === 1 && receiptsPage > 0) {
        setReceiptsPage((p) => p - 1);
      }
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error: unknown) => {
      const err = error as { code?: string; message?: string };
      const isNegativeBalance =
        err?.code === "P0423" ||
        (err?.message?.includes("CASHBACK_BALANCE_NEGATIVE") ?? false);
      toast.error("Suppression impossible", {
        description: isNegativeBalance
          ? "Les Paraiges de Bronze gagnés sur ce ticket ont déjà été dépensés ailleurs : le supprimer rendrait le solde du client négatif."
          : "Impossible de supprimer ce ticket. Réessayez ou consultez les logs.",
      });
    },
  });

  const deletingReceiptId = deleteMutation.isPending
    ? deleteMutation.variables
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tickets de l’utilisateur</CardTitle>
        <CardDescription>
          {receiptsTotal} ticket{receiptsTotal > 1 ? "s" : ""} au total
        </CardDescription>
      </CardHeader>
      <CardContent>
        {receiptsQuery.isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : receipts.length === 0 ? (
          <EmptyState icon={Receipt} title="Aucun ticket pour cet utilisateur" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Établissement</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead>Consommations</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                  return (
                    <TableRow key={receipt.id}>
                      <TableCell className="font-mono text-sm">#{receipt.id}</TableCell>
                      <TableCell>
                        {receipt.establishment?.title || `Établissement #${receipt.establishment_id}`}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("font-semibold", amountConfig?.badgeClass)}
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
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={deletingReceiptId === receipt.id}
                              aria-label={`Supprimer le ticket #${receipt.id}`}
                            >
                              {deletingReceiptId === receipt.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Supprimer le ticket #{receipt.id} ?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est <strong>irréversible</strong>.
                                Le ticket et toutes ses données liées seront
                                définitivement supprimés :
                                lignes de paiement, gains (XP et Paraiges de
                                Bronze), consommations, dépenses, et
                                réconciliation Cashpad éventuelle. Le solde de
                                PdB et le niveau du client seront recalculés en
                                conséquence.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(receipt.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Supprimer définitivement
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <TablePagination
              page={receiptsPage}
              pageCount={receiptsPages}
              onPageChange={setReceiptsPage}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
