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
import { History, Loader2 } from "lucide-react";
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
          {logsQuery.isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2
                className="h-6 w-6 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          ) : logs.length === 0 ? (
            <EmptyState icon={History} title="Aucune distribution trouvée" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Rang</TableHead>
                    <TableHead>Palier</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>XP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {log.distributed_at ? formatDateTime(log.distributed_at) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {log.distribution_type === "manual" && "Manuel"}
                          {log.distribution_type?.startsWith("leaderboard") &&
                            "Leaderboard"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.period_identifier || "-"}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {log.profiles
                              ? `${log.profiles.first_name || ""} ${
                                  log.profiles.last_name || ""
                                }`.trim() || log.profiles.email
                              : "Inconnu"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {log.profiles?.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.rank ? (
                          <Badge variant={log.rank <= 3 ? "default" : "secondary"}>
                            #{log.rank}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{log.reward_tiers?.name || "-"}</TableCell>
                      <TableCell>{log.coupon_templates?.name || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.xp_at_distribution?.toLocaleString() || "-"}
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
                      aria-label="Page précédente"
                      onClick={() => setPage(page - 1)}
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      aria-label="Page suivante"
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
