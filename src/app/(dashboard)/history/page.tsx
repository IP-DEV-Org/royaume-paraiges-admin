"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { History } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getDistributionLogs } from "@/lib/services/couponService";
import { historyKeys } from "@/lib/queries/keys";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import type { CouponDistributionLog } from "@/types/database";

type LogWithRelations = CouponDistributionLog & {
  profiles: { first_name: string | null; last_name: string | null; email: string | null } | null;
  coupon_templates: { name: string } | null;
  reward_tiers: { name: string } | null;
};

const limit = 30;

export default function HistoryPage() {
  const [page, setPage] = useState(0);
  const [distributionType, setDistributionType] = useState<string | undefined>(
    undefined
  );

  const logsQuery = useQuery({
    queryKey: historyKeys.list({ page, limit, distributionType }),
    queryFn: () => getDistributionLogs(limit, page * limit, { distributionType }),
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (logsQuery.error) {
      console.error(logsQuery.error);
      toast.error("Erreur", {
        description: "Impossible de charger l'historique",
      });
    }
  }, [logsQuery.error]);

  const logs = (logsQuery.data?.data ?? []) as LogWithRelations[];
  const total = logsQuery.data?.count ?? 0;
  const totalPages = Math.ceil(total / limit);

  const columns: DataTableColumn<LogWithRelations>[] = [
    {
      key: "distributed_at",
      header: "Date",
      sortable: true,
      sortValue: (log) => log.distributed_at,
      cellClassName: "text-sm",
      cell: (log) =>
        log.distributed_at ? formatDateTime(log.distributed_at) : "-",
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      sortValue: (log) =>
        log.distribution_type === "manual"
          ? "Manuel"
          : log.distribution_type?.startsWith("leaderboard")
            ? "Leaderboard"
            : log.distribution_type,
      cell: (log) => (
        <Badge variant="outline">
          {log.distribution_type === "manual" && "Manuel"}
          {log.distribution_type?.startsWith("leaderboard") && "Leaderboard"}
        </Badge>
      ),
    },
    {
      key: "period",
      header: "Période",
      sortable: true,
      sortValue: (log) => log.period_identifier,
      cellClassName: "font-mono text-sm",
      cell: (log) => log.period_identifier || "-",
    },
    {
      key: "user",
      header: "Utilisateur",
      sortable: true,
      sortValue: (log) =>
        log.profiles
          ? `${log.profiles.first_name || ""} ${log.profiles.last_name || ""}`.trim() ||
            log.profiles.email
          : null,
      cell: (log) => (
        <div>
          <p className="font-medium">
            {log.profiles
              ? `${log.profiles.first_name || ""} ${log.profiles.last_name || ""}`.trim() ||
                log.profiles.email
              : "Inconnu"}
          </p>
          <p className="text-xs text-muted-foreground">{log.profiles?.email}</p>
        </div>
      ),
    },
    {
      key: "rank",
      header: "Rang",
      sortable: true,
      sortValue: (log) => log.rank,
      cell: (log) =>
        log.rank ? (
          <Badge variant={log.rank <= 3 ? "default" : "secondary"}>
            #{log.rank}
          </Badge>
        ) : (
          "-"
        ),
    },
    {
      key: "tier",
      header: "Palier",
      sortable: true,
      sortValue: (log) => log.reward_tiers?.name,
      cell: (log) => log.reward_tiers?.name || "-",
    },
    {
      key: "template",
      header: "Template",
      sortable: true,
      sortValue: (log) => log.coupon_templates?.name,
      cell: (log) => log.coupon_templates?.name || "-",
    },
    {
      key: "xp",
      header: "XP",
      sortable: true,
      sortValue: (log) => log.xp_at_distribution,
      cellClassName: "text-muted-foreground",
      cell: (log) => log.xp_at_distribution?.toLocaleString() || "-",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historique"
        description="Journal des distributions de coupons"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle>Distributions</CardTitle>
              <CardDescription>
                {total} distribution{total > 1 ? "s" : ""} au total
              </CardDescription>
            </div>
            <Select
              value={distributionType || "all"}
              onValueChange={(value) => {
                setPage(0);
                setDistributionType(value === "all" ? undefined : value);
              }}
            >
              <SelectTrigger className="w-[150px] shrink-0 sm:w-[200px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="leaderboard_weekly">Leaderboard Hebdo</SelectItem>
                <SelectItem value="leaderboard_monthly">Leaderboard Mensuel</SelectItem>
                <SelectItem value="leaderboard_yearly">Leaderboard Annuel</SelectItem>
                <SelectItem value="manual">Manuel</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={logs}
            rowKey={(log) => log.id}
            loading={logsQuery.isLoading}
            emptyState={
              <EmptyState icon={History} title="Aucune distribution trouvée" />
            }
            pagination={{ page, totalPages, onPageChange: setPage }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
