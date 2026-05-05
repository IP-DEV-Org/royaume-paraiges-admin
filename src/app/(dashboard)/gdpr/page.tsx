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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Loader2, Download, CheckCircle, Shield } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatDateTime } from "@/lib/utils";
import {
  getGdprRequests,
  exportUserData,
  updateGdprRequestStatus,
  type GdprRequestWithProfile,
} from "@/lib/services/gdprService";

const statusLabels: Record<string, string> = {
  pending: "En attente",
  processing: "En cours",
  completed: "Traitee",
  rejected: "Rejetee",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  processing: "secondary",
  completed: "default",
  rejected: "destructive",
};

const typeLabels: Record<string, string> = {
  export: "Export",
  deletion: "Suppression",
  rectification: "Rectification",
};

export default function GdprPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<GdprRequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const pageSize = 20;

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const { data, count } = await getGdprRequests(
        pageSize,
        page * pageSize,
        statusFilter
      );
      setRequests(data);
      setTotalCount(count);
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de charger les demandes RGPD",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, toast]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleExport = async (userId: string) => {
    try {
      setExportingId(userId);
      const data = await exportUserData(userId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gdpr-export-${userId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Export telecharge" });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'exporter les donnees",
        variant: "destructive",
      });
    } finally {
      setExportingId(null);
    }
  };

  const handleMarkProcessed = async (requestId: string) => {
    try {
      setProcessingId(requestId);
      await updateGdprRequestStatus(requestId, "completed");
      toast({ title: "Demande marquee comme traitee" });
      await loadRequests();
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de mettre a jour le statut",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Demandes RGPD</h1>
        <p className="text-muted-foreground">
          Gestion des demandes de donnees personnelles
        </p>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
        <TabsList>
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="pending">En attente</TabsTrigger>
          <TabsTrigger value="completed">Traitees</TabsTrigger>
          <TabsTrigger value="rejected">Rejetees</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Demandes ({totalCount})
          </CardTitle>
          <CardDescription>
            Liste des demandes RGPD des utilisateurs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Aucune demande trouvee
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {request.profiles
                              ? `${request.profiles.first_name || ""} ${request.profiles.last_name || ""}`.trim() || "Anonyme"
                              : "Utilisateur supprime"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {request.profiles?.email || "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {typeLabels[request.request_type] || request.request_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariants[request.status] || "outline"}>
                          {statusLabels[request.status] || request.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(request.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExport(request.user_id)}
                            disabled={exportingId === request.user_id}
                          >
                            {exportingId === request.user_id ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Download className="mr-1 h-3 w-3" />
                            )}
                            Export
                          </Button>
                          {request.status === "pending" && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleMarkProcessed(request.id)}
                              disabled={processingId === request.id}
                            >
                              {processingId === request.id ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle className="mr-1 h-3 w-3" />
                              )}
                              Traiter
                            </Button>
                          )}
                        </div>
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
                      Precedent
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
