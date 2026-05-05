"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Loader2 } from "lucide-react";
import {
  getCoupons,
  getBonusCashbackGains,
  type CouponFilters,
  type GainWithProfile,
} from "@/lib/services/couponService";
import { formatCurrency, formatPercentage, formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import type { Coupon } from "@/types/database";

type CouponWithRelations = Coupon & {
  profiles: { first_name: string | null; last_name: string | null; email: string | null } | null;
  coupon_templates: { name: string } | null;
};

type RewardItem = {
  kind: "coupon" | "gain";
  id: number;
  customer_id: string;
  created_at: string;
  profiles: { first_name: string | null; last_name: string | null; email: string | null } | null;
  // Coupon fields
  percentage?: number | null;
  amount?: number | null;
  used?: boolean;
  expires_at?: string | null;
  distribution_type?: string | null;
  period_identifier?: string | null;
  template_name?: string | null;
  // Gain fields
  cashback_money?: number | null;
  source_type?: string | null;
};

type RewardTypeFilter = "all" | "coupons" | "gains";

function couponToRewardItem(coupon: CouponWithRelations): RewardItem {
  return {
    kind: "coupon",
    id: coupon.id,
    customer_id: coupon.customer_id,
    created_at: coupon.created_at,
    profiles: coupon.profiles,
    percentage: coupon.percentage,
    amount: coupon.amount,
    used: coupon.used,
    expires_at: coupon.expires_at,
    distribution_type: coupon.distribution_type,
    period_identifier: coupon.period_identifier,
    template_name: coupon.coupon_templates?.name ?? null,
  };
}

function gainToRewardItem(gain: GainWithProfile): RewardItem {
  return {
    kind: "gain",
    id: gain.id,
    customer_id: gain.customer_id,
    created_at: gain.created_at,
    profiles: gain.profiles,
    cashback_money: gain.cashback_money,
    source_type: gain.source_type,
    period_identifier: gain.period_identifier,
  };
}

function getSourceLabel(item: RewardItem): string {
  if (item.kind === "gain") {
    const st = item.source_type || "";
    if (st.includes("manual")) return "Manuel";
    if (st.includes("leaderboard")) return "Leaderboard";
    if (st.includes("quest")) return "Quête";
    if (st.includes("trigger")) return "Trigger";
    return st.replace("bonus_cashback_", "").replace(/_/g, " ") || "-";
  }
  if (item.distribution_type === "manual") return "Manuel";
  if (item.distribution_type?.startsWith("leaderboard")) return "Leaderboard";
  if (item.distribution_type === "trigger_legacy") return "Legacy";
  if (item.distribution_type === "quest") return "Quête";
  return item.distribution_type || "-";
}

function isExpired(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

export default function RewardsPage() {
  const [coupons, setCoupons] = useState<CouponWithRelations[]>([]);
  const [gains, setGains] = useState<GainWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [rewardTypeFilter, setRewardTypeFilter] = useState<RewardTypeFilter>("all");
  const [couponFilters, setCouponFilters] = useState<CouponFilters>({});
  const [page, setPage] = useState(0);
  const { toast } = useToast();
  const router = useRouter();

  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const promises: Promise<void>[] = [];

      if (rewardTypeFilter !== "gains") {
        promises.push(
          getCoupons(couponFilters, 100, 0).then(({ data }) => {
            setCoupons(data as CouponWithRelations[]);
          })
        );
      } else {
        setCoupons([]);
      }

      if (rewardTypeFilter !== "coupons") {
        promises.push(
          getBonusCashbackGains(100, 0).then(({ data }) => {
            setGains(data);
          })
        );
      } else {
        setGains([]);
      }

      await Promise.all(promises);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les récompenses",
      });
    } finally {
      setLoading(false);
    }
  }, [rewardTypeFilter, couponFilters, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [rewardTypeFilter, couponFilters]);

  // Merge and sort
  const allItems: RewardItem[] = [
    ...coupons.map(couponToRewardItem),
    ...gains.map(gainToRewardItem),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const totalItems = allItems.length;
  const totalPages = Math.ceil(totalItems / limit);
  const paginatedItems = allItems.slice(page * limit, (page + 1) * limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Recompenses</h1>
          <p className="text-muted-foreground">
            Liste de toutes les récompenses distribuées
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 overflow-x-auto sm:flex-wrap sm:gap-4 sm:justify-between">
            <Select
              value={rewardTypeFilter}
              onValueChange={(value) => {
                setRewardTypeFilter(value as RewardTypeFilter);
              }}
            >
              <SelectTrigger className="w-[140px] shrink-0 sm:w-[200px]">
                <SelectValue placeholder="Type de récompense" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="coupons">Coupons (%)</SelectItem>
                <SelectItem value="gains">Bonus Cashback</SelectItem>
              </SelectContent>
            </Select>

            {rewardTypeFilter !== "gains" && (
              <div className="flex items-center gap-2 sm:gap-3">
                <Select
                  value={couponFilters.isUsed?.toString() || "all"}
                  onValueChange={(value) => {
                    setCouponFilters({
                      ...couponFilters,
                      isUsed: value === "all" ? undefined : value === "true",
                    });
                  }}
                >
                  <SelectTrigger className="w-[120px] shrink-0 sm:w-[180px]">
                    <SelectValue placeholder="Statut coupon" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="false">Non utilise</SelectItem>
                    <SelectItem value="true">Utilisé</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={couponFilters.distributionType || "all"}
                  onValueChange={(value) => {
                    setCouponFilters({
                      ...couponFilters,
                      distributionType: value === "all" ? undefined : value,
                    });
                  }}
                >
                  <SelectTrigger className="w-[140px] shrink-0 sm:w-[200px]">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les sources</SelectItem>
                    <SelectItem value="leaderboard_weekly">Leaderboard Hebdo</SelectItem>
                    <SelectItem value="leaderboard_monthly">Leaderboard Mensuel</SelectItem>
                    <SelectItem value="leaderboard_yearly">Leaderboard Annuel</SelectItem>
                    <SelectItem value="manual">Manuel</SelectItem>
                    <SelectItem value="trigger_legacy">Legacy</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={couponFilters.isExpired?.toString() || "all"}
                  onValueChange={(value) => {
                    setCouponFilters({
                      ...couponFilters,
                      isExpired: value === "all" ? undefined : value === "true",
                    });
                  }}
                >
                  <SelectTrigger className="w-[120px] shrink-0 sm:w-[180px]">
                    <SelectValue placeholder="Expiration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="false">Valide</SelectItem>
                    <SelectItem value="true">Expire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste des récompenses</CardTitle>
          <CardDescription>
            {totalItems} récompense{totalItems > 1 ? "s" : ""} au total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : paginatedItems.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Aucune récompense trouvée
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Valeur</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item) => (
                    <TableRow
                      key={`${item.kind}-${item.id}`}
                      className="cursor-pointer"
                      onClick={() => router.push(`/users/${item.customer_id}`)}
                    >
                      <TableCell className="font-mono text-sm">
                        {item.kind === "coupon" ? `#C${item.id}` : `#G${item.id}`}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">
                            {item.profiles
                              ? `${item.profiles.first_name || ""} ${item.profiles.last_name || ""}`.trim() || item.profiles.email
                              : "Inconnu"}
                          </span>
                          <p className="text-sm text-muted-foreground">
                            {item.profiles?.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.kind === "gain" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            Cashback: {formatCurrency(item.cashback_money || 0)}
                          </Badge>
                        ) : item.percentage ? (
                          <Badge variant="secondary">
                            Coupon: {formatPercentage(item.percentage)}
                          </Badge>
                        ) : item.amount ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            Bonus CB: {formatCurrency(item.amount)}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getSourceLabel(item)}</span>
                        {item.period_identifier && (
                          <p className="text-xs text-muted-foreground">
                            {item.period_identifier}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.kind === "gain" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Crédité</Badge>
                        ) : item.amount && item.used ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Crédité</Badge>
                        ) : item.used ? (
                          <Badge variant="secondary">Utilisé</Badge>
                        ) : isExpired(item.expires_at) ? (
                          <Badge variant="destructive">Expire</Badge>
                        ) : (
                          <Badge variant="success">Actif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(item.created_at)}
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
