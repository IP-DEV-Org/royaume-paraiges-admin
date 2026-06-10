"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Ticket } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { getUserCoupons } from "@/lib/services/userService";
import { userKeys } from "@/lib/queries/keys";
import { toast } from "sonner";
import { formatCurrency, formatDate, formatPercentage } from "@/lib/utils";
import { TablePagination } from "./table-pagination";
import { USER_DETAIL_PAGE_SIZE } from "./types";

const isExpired = (expiresAt: string | null) => {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
};

export function CouponsTab({ userId }: { userId: string }) {
  const [couponsPage, setCouponsPage] = useState(0);

  const couponsQuery = useQuery({
    queryKey: [...userKeys.detail(userId), "coupons", { page: couponsPage }],
    queryFn: () =>
      getUserCoupons(userId, USER_DETAIL_PAGE_SIZE, couponsPage * USER_DETAIL_PAGE_SIZE),
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (couponsQuery.error) {
      console.error(couponsQuery.error);
      toast.error("Erreur", {
        description: "Impossible de charger les coupons",
      });
    }
  }, [couponsQuery.error]);

  const coupons = couponsQuery.data?.data ?? [];
  const couponsTotal = couponsQuery.data?.count ?? 0;
  const couponsPages = Math.ceil(couponsTotal / USER_DETAIL_PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coupons de l’utilisateur</CardTitle>
        <CardDescription>
          {couponsTotal} coupon{couponsTotal > 1 ? "s" : ""} au total
        </CardDescription>
      </CardHeader>
      <CardContent>
        {couponsQuery.isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : coupons.length === 0 ? (
          <EmptyState icon={Ticket} title="Aucun coupon pour cet utilisateur" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Valeur</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Créé le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell className="font-mono text-sm">#{coupon.id}</TableCell>
                    <TableCell>
                      {coupon.amount ? (
                        <Badge variant="default">{formatCurrency(coupon.amount)}</Badge>
                      ) : coupon.percentage ? (
                        <Badge variant="secondary">{formatPercentage(coupon.percentage)}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {coupon.coupon_templates?.name || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {coupon.distribution_type === "manual" && "Manuel"}
                      {coupon.distribution_type?.startsWith("leaderboard") && "Leaderboard"}
                      {coupon.distribution_type === "trigger_legacy" && "Legacy"}
                      {!coupon.distribution_type && "-"}
                    </TableCell>
                    <TableCell>
                      {coupon.used ? (
                        <StatusBadge status="used" />
                      ) : isExpired(coupon.expires_at) ? (
                        <StatusBadge status="expired" label="Expiré" tone="destructive" />
                      ) : (
                        <StatusBadge status="active" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {coupon.expires_at ? formatDate(coupon.expires_at) : "Sans expiration"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(coupon.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <TablePagination
              page={couponsPage}
              pageCount={couponsPages}
              onPageChange={setCouponsPage}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
