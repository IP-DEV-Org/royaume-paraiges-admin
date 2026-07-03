"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ChevronDown, ChevronUp, Plus, Ticket } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCoupons, type CouponFilters } from "@/lib/services/couponService";
import { formatPercentage, formatDate } from "@/lib/utils";
import { couponKeys } from "@/lib/queries/keys";
import type { Coupon } from "@/types/database";

type CouponWithRelations = Coupon & {
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  coupon_templates: { name: string } | null;
};

type StatusFilter = "all" | "active" | "used" | "expired";

const statusToCouponFilters: Record<StatusFilter, Partial<CouponFilters>> = {
  all: {},
  active: { isUsed: false, isExpired: false },
  used: { isUsed: true },
  expired: { isUsed: false, isExpired: true },
};

function getSourceLabel(distributionType: string | null | undefined): string {
  if (distributionType === "manual") return "Manuel";
  if (distributionType?.startsWith("leaderboard")) return "Leaderboard";
  if (distributionType === "trigger_legacy") return "Legacy";
  if (distributionType === "quest") return "Quête";
  return distributionType || "-";
}

function isExpired(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

export default function CouponsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [distributionType, setDistributionType] = useState<string | undefined>(
    undefined,
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [page, setPage] = useState(0);

  const limit = 20;

  const couponFilters: CouponFilters = useMemo(
    () => ({
      couponType: "percentage",
      ...statusToCouponFilters[statusFilter],
      distributionType,
    }),
    [statusFilter, distributionType],
  );

  const couponsQuery = useQuery({
    queryKey: couponKeys.list({
      kind: "coupons-only",
      ...(couponFilters as Record<string, unknown>),
    }),
    queryFn: async () => {
      const { data } = await getCoupons(couponFilters, 100, 0);
      return data as CouponWithRelations[];
    },
  });

  useEffect(() => {
    if (couponsQuery.error) {
      console.error(couponsQuery.error);
      toast.error("Erreur", {
        description: "Impossible de charger les coupons",
      });
    }
  }, [couponsQuery.error]);

  const onStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setPage(0);
  };

  const onDistributionTypeChange = (value: string) => {
    setDistributionType(value === "all" ? undefined : value);
    setPage(0);
  };

  const coupons = couponsQuery.data ?? [];
  const sorted = [...coupons].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const totalItems = sorted.length;
  const totalPages = Math.ceil(totalItems / limit);
  const paginatedItems = sorted.slice(page * limit, (page + 1) * limit);

  const columns: DataTableColumn<CouponWithRelations>[] = [
    {
      key: "id",
      header: "ID",
      sortable: true,
      sortValue: (item) => item.id,
      cellClassName: "font-mono text-sm",
      cell: (item) => <>#{item.id}</>,
    },
    {
      key: "user",
      header: "Utilisateur",
      sortable: true,
      sortValue: (item) =>
        item.profiles
          ? `${item.profiles.first_name || ""} ${item.profiles.last_name || ""}`.trim() ||
            item.profiles.email
          : null,
      cell: (item) => (
        <div>
          <span className="font-medium">
            {item.profiles
              ? `${item.profiles.first_name || ""} ${item.profiles.last_name || ""}`.trim() ||
                item.profiles.email
              : "Inconnu"}
          </span>
          <p className="text-sm text-muted-foreground">{item.profiles?.email}</p>
        </div>
      ),
    },
    {
      key: "percentage",
      header: "Réduction",
      sortable: true,
      sortValue: (item) => item.percentage,
      cell: (item) =>
        item.percentage ? (
          <Badge
            variant="outline"
            className="border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300"
          >
            {formatPercentage(item.percentage)}
          </Badge>
        ) : (
          "-"
        ),
    },
    {
      key: "source",
      header: "Source",
      sortable: true,
      sortValue: (item) => getSourceLabel(item.distribution_type),
      cell: (item) => (
        <>
          <span className="text-sm">{getSourceLabel(item.distribution_type)}</span>
          {item.period_identifier && (
            <p className="text-xs text-muted-foreground">{item.period_identifier}</p>
          )}
        </>
      ),
    },
    {
      key: "status",
      header: "Statut",
      sortable: true,
      sortValue: (item) =>
        item.used ? "Utilisé" : isExpired(item.expires_at) ? "Expiré" : "Actif",
      cell: (item) =>
        item.used ? (
          <StatusBadge status="used" />
        ) : isExpired(item.expires_at) ? (
          <StatusBadge status="expired" label="Expiré" tone="destructive" />
        ) : (
          <StatusBadge status="active" />
        ),
    },
    {
      key: "created_at",
      header: "Date",
      sortable: true,
      sortValue: (item) => item.created_at,
      cellClassName: "text-sm text-muted-foreground",
      cell: (item) => formatDate(item.created_at),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coupons"
        description="Coupons (%) distribués aux utilisateurs."
        actions={
          <Link href="/coupons/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Nouveau coupon
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={statusFilter}
              onValueChange={(v) => onStatusChange(v as StatusFilter)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="used">Utilisé</SelectItem>
                <SelectItem value="expired">Expiré</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced((s) => !s)}
              className="ml-auto"
            >
              Filtres avancés
              {showAdvanced ? (
                <ChevronUp className="ml-1 h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="ml-1 h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </div>

          {showAdvanced && (
            <div className="flex flex-wrap items-center gap-3 border-t pt-3">
              <Select
                value={distributionType ?? "all"}
                onValueChange={onDistributionTypeChange}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les sources</SelectItem>
                  <SelectItem value="leaderboard_weekly">
                    Leaderboard Hebdo
                  </SelectItem>
                  <SelectItem value="leaderboard_monthly">
                    Leaderboard Mensuel
                  </SelectItem>
                  <SelectItem value="leaderboard_yearly">
                    Leaderboard Annuel
                  </SelectItem>
                  <SelectItem value="manual">Manuel</SelectItem>
                  <SelectItem value="trigger_legacy">Legacy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste des coupons</CardTitle>
          <CardDescription>
            {totalItems} coupon{totalItems > 1 ? "s" : ""} au total
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={paginatedItems}
            rowKey={(item) => item.id}
            loading={couponsQuery.isLoading}
            onRowClick={(item) => router.push(`/users/${item.customer_id}`)}
            emptyState={
              <EmptyState
                icon={Ticket}
                title={
                  statusFilter !== "all" || distributionType
                    ? "Aucun résultat pour cette recherche"
                    : "Aucun coupon trouvé"
                }
                description={
                  statusFilter !== "all" || distributionType
                    ? "Essayez d'élargir les filtres."
                    : undefined
                }
                action={
                  statusFilter === "all" && !distributionType ? (
                    <Button asChild>
                      <Link href="/coupons/create">Créer un coupon</Link>
                    </Button>
                  ) : undefined
                }
              />
            }
            pagination={{ page, totalPages, onPageChange: setPage }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
