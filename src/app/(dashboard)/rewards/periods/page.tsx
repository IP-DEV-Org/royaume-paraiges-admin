"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Calendar, Loader2, PlayCircle, Settings, Plus } from "lucide-react";
import { getPeriodConfigs } from "@/lib/services/rewardService";
import { periodKeys } from "@/lib/queries/keys";
import { formatDateTime } from "@/lib/utils";
import type { PeriodType } from "@/types/database";

export default function PeriodsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("weekly");

  const {
    data: configs = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: periodKeys.lists(),
    queryFn: () => getPeriodConfigs(),
  });

  useEffect(() => {
    if (error) {
      console.error(error);
      toast.error("Erreur", {
        description: "Impossible de charger les périodes",
      });
    }
  }, [error]);

  const filteredConfigs = configs.filter((c) => c.period_type === selectedPeriod);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/rewards">
          <Button variant="ghost" size="icon" aria-label="Retour aux récompenses">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Link>
        <PageHeader
          className="flex-1"
          title="Périodes"
          description="Historique et configuration des périodes de distribution"
          actions={
            <>
              <Link href="/rewards/periods/create">
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Nouvelle période
                </Button>
              </Link>
              <Link href="/rewards/distribute">
                <Button>
                  <PlayCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                  Distribuer
                </Button>
              </Link>
            </>
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique des périodes</CardTitle>
          <CardDescription>
            Visualisez l&apos;état des distributions par période
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={selectedPeriod}
            onValueChange={(v) => setSelectedPeriod(v as PeriodType)}
          >
            <TabsList className="mb-4">
              <TabsTrigger value="weekly">Hebdomadaire</TabsTrigger>
              <TabsTrigger value="monthly">Mensuel</TabsTrigger>
              <TabsTrigger value="yearly">Annuel</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedPeriod}>
              {filteredConfigs.length === 0 ? (
                <EmptyState icon={Calendar} title="Aucune période configurée" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Période</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Configuration</TableHead>
                      <TableHead>Date de distribution</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredConfigs.map((config) => {
                      const hasCustomTiers = config.custom_tiers !== null;

                      return (
                        <TableRow key={config.id}>
                          <TableCell className="font-medium">
                            {config.period_identifier}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={config.status ?? "pending"} />
                          </TableCell>
                          <TableCell>
                            <Badge variant={hasCustomTiers ? "secondary" : "outline"}>
                              {hasCustomTiers ? "Personnalisée" : "Par défaut"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {config.distributed_at
                              ? formatDateTime(config.distributed_at)
                              : "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {config.notes || "-"}
                          </TableCell>
                          <TableCell>
                            <Link href={`/rewards/periods/${config.period_type}/${config.period_identifier}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`Configurer la période ${config.period_identifier}`}
                              >
                                <Settings className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
