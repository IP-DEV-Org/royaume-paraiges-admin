"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Gift, Loader2 } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { getUserGains } from "@/lib/services/userService";
import { userKeys } from "@/lib/queries/keys";
import { toast } from "sonner";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { TablePagination } from "./table-pagination";
import { USER_DETAIL_PAGE_SIZE } from "./types";

const sourceTypeLabels: Record<string, string> = {
  receipt: "Ticket",
  bonus_cashback_manual: "Bonus manuel",
  bonus_cashback_leaderboard: "Classement",
  bonus_cashback_quest: "Quête",
  bonus_cashback_trigger: "Trigger",
  bonus_cashback_migration: "Migration",
};

export function GainsTab({ userId }: { userId: string }) {
  const router = useRouter();
  const [gainsPage, setGainsPage] = useState(0);
  const [gainsSourceFilter, setGainsSourceFilter] = useState("all");

  const gainsQuery = useQuery({
    queryKey: [
      ...userKeys.detail(userId),
      "gains",
      { page: gainsPage, source: gainsSourceFilter },
    ],
    queryFn: () =>
      getUserGains(
        userId,
        USER_DETAIL_PAGE_SIZE,
        gainsPage * USER_DETAIL_PAGE_SIZE,
        gainsSourceFilter !== "all" ? gainsSourceFilter : undefined
      ),
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (gainsQuery.error) {
      console.error(gainsQuery.error);
      toast.error("Erreur", {
        description: "Impossible de charger les gains",
      });
    }
  }, [gainsQuery.error]);

  const gains = gainsQuery.data?.data ?? [];
  const gainsTotal = gainsQuery.data?.count ?? 0;
  const gainsPages = Math.ceil(gainsTotal / USER_DETAIL_PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gains de l’utilisateur</CardTitle>
            <CardDescription>
              {gainsTotal} gain{gainsTotal > 1 ? "s" : ""} au total
            </CardDescription>
          </div>
          <Select
            value={gainsSourceFilter}
            onValueChange={(value) => {
              setGainsSourceFilter(value);
              setGainsPage(0);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrer par source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les sources</SelectItem>
              <SelectItem value="receipt">Ticket</SelectItem>
              <SelectItem value="bonus_cashback_manual">Bonus manuel</SelectItem>
              <SelectItem value="bonus_cashback_leaderboard">Classement</SelectItem>
              <SelectItem value="bonus_cashback_quest">Quête</SelectItem>
              <SelectItem value="bonus_cashback_trigger">Trigger</SelectItem>
              <SelectItem value="bonus_cashback_migration">Migration</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {gainsQuery.isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : gains.length === 0 ? (
          <EmptyState
            icon={Gift}
            title={
              gainsSourceFilter !== "all"
                ? "Aucun résultat pour cette recherche"
                : "Aucun gain pour cet utilisateur"
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>XP</TableHead>
                  <TableHead>Cashback</TableHead>
                  <TableHead>Établissement</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gains.map((gain) => {
                  // Lien cliquable vers la quête sur les gains bonus_cashback_quest.
                  const questLink =
                    gain.source_type === "bonus_cashback_quest" && gain.quest
                      ? gain.quest
                      : null;
                  return (
                    <TableRow
                      key={gain.id}
                      className={
                        questLink ? "cursor-pointer hover:bg-muted/50" : undefined
                      }
                      onClick={
                        questLink
                          ? () => router.push(`/quests/${questLink.id}`)
                          : undefined
                      }
                    >
                      <TableCell className="font-mono text-sm">#G{gain.id}</TableCell>
                      <TableCell>
                        {gain.source_type ? (
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={gain.source_type === "receipt" ? "default" : "secondary"}
                              className={
                                gain.source_type !== "receipt"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : undefined
                              }
                            >
                              {sourceTypeLabels[gain.source_type] || gain.source_type}
                            </Badge>
                            {questLink && (
                              <span className="inline-flex items-center gap-0.5 text-sm font-medium text-foreground">
                                {questLink.name}
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {gain.xp != null && gain.xp > 0 ? (
                          <span className="font-medium">{gain.xp.toLocaleString()} XP</span>
                        ) : (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {gain.cashback_money != null && gain.cashback_money > 0 ? (
                          <span className="font-medium">{formatCurrency(gain.cashback_money)}</span>
                        ) : (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {gain.establishment?.title || (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {gain.period_identifier || (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(gain.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <TablePagination
              page={gainsPage}
              pageCount={gainsPages}
              onPageChange={setGainsPage}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
