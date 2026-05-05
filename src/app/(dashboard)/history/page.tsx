"use client";

import { useCallback, useEffect, useState } from "react";
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
import { getDistributionLogs } from "@/lib/services/couponService";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import type { CouponDistributionLog } from "@/types/database";

type LogWithRelations = CouponDistributionLog & {
  profiles: { first_name: string | null; last_name: string | null; email: string | null } | null;
  coupon_templates: { name: string } | null;
  reward_tiers: { name: string } | null;
};

export default function HistoryPage() {
  const [logs, setLogs] = useState<LogWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<{
    distributionType?: string;
  }>({});
  const { toast } = useToast();

  const limit = 30;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, count } = await getDistributionLogs(limit, page * limit, filters);
      setLogs(data as LogWithRelations[]);
      setTotal(count || 0);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger l'historique",
      });
    } finally {
      setLoading(false);
    }
  }, [page, filters, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Historique</h1>
        <p className="text-muted-foreground">
          Journal des distributions de coupons
        </p>
      </div>

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
              value={filters.distributionType || "all"}
              onValueChange={(value) => {
                setPage(0);
                setFilters({
                  ...filters,
                  distributionType: value === "all" ? undefined : value,
                });
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
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Aucune distribution trouvée
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Periode</TableHead>
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
