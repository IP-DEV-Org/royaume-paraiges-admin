"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Plus, MoreHorizontal, Trash2, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getTemplates,
  toggleTemplateActive,
  deleteTemplate,
} from "@/lib/services/templateService";
import { formatCurrency, formatPercentage, formatDate } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { templateKeys } from "@/lib/queries/keys";
import type { CouponTemplate } from "@/types/database";

export default function TemplatesPage() {
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: templates = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: templateKeys.lists(),
    queryFn: () => getTemplates() as Promise<CouponTemplate[]>,
  });

  useEffect(() => {
    if (error) {
      console.error(error);
      toast.error("Erreur", {
        description: "Impossible de charger les templates",
      });
    }
  }, [error]);

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      toggleTemplateActive(id, isActive),
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
      toast.success(isActive ? "Template activé" : "Template désactivé");
    },
    onError: () => {
      toast.error("Erreur", {
        description: "Impossible de modifier le template",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
      toast.success("Template supprimé");
    },
    onError: () => {
      toast.error("Erreur", {
        description: "Impossible de supprimer le template",
      });
    },
    onSettled: () => setDeleteId(null),
  });

  const columns: DataTableColumn<CouponTemplate>[] = [
    {
      key: "name",
      header: "Nom",
      sortable: true,
      sortValue: (template) => template.name,
      cell: (template) => (
        <div>
          <p className="font-medium">{template.name}</p>
          {template.description && (
            <p className="text-sm text-muted-foreground">{template.description}</p>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      sortValue: (template) =>
        template.amount ? "Bonus Cashback" : template.percentage ? "Coupon" : null,
      cell: (template) =>
        template.amount ? (
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            Bonus Cashback
          </Badge>
        ) : template.percentage ? (
          <Badge variant="secondary">Coupon</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: "value",
      header: "Valeur",
      sortable: true,
      sortValue: (template) => template.amount ?? template.percentage,
      cell: (template) =>
        template.amount ? (
          <Badge variant="default">{formatCurrency(template.amount)}</Badge>
        ) : template.percentage ? (
          <Badge variant="secondary">{formatPercentage(template.percentage)}</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: "validity",
      header: "Validité",
      sortable: true,
      sortValue: (template) => template.validity_days,
      cell: (template) =>
        template.validity_days ? (
          <span>{template.validity_days} jours</span>
        ) : (
          <span className="text-muted-foreground">Sans expiration</span>
        ),
    },
    {
      key: "active",
      header: "Actif",
      sortable: true,
      sortValue: (template) => (template.is_active ? 1 : 0),
      cell: (template) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            aria-label={`Activer ou désactiver le template ${template.name}`}
            checked={template.is_active ?? false}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ id: template.id, isActive: checked })
            }
            disabled={toggleMutation.isPending}
          />
        </div>
      ),
    },
    {
      key: "created_at",
      header: "Créé le",
      sortable: true,
      sortValue: (template) => template.created_at,
      cellClassName: "text-muted-foreground",
      cell: (template) =>
        template.created_at ? formatDate(template.created_at) : "-",
    },
    {
      key: "actions",
      header: "",
      headerClassName: "w-[50px]",
      cell: (template) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Actions du template">
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <Link href={`/templates/create?duplicate=${template.id}`}>
                <DropdownMenuItem>
                  <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                  Dupliquer
                </DropdownMenuItem>
              </Link>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteId(template.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates de coupons"
        description="Gérez les modèles de coupons réutilisables"
        actions={
          <Link href="/templates/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Nouveau template
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Tous les templates</CardTitle>
          <CardDescription>
            {templates.length} template{templates.length > 1 ? "s" : ""} au total
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={templates}
            rowKey={(template) => template.id}
            loading={isLoading}
            onRowClick={(template) => router.push(`/templates/${template.id}`)}
            emptyState={
              <EmptyState
                icon={Copy}
                title="Aucun template"
                description="Créez-en un pour commencer."
                action={
                  <Button asChild>
                    <Link href="/templates/create">Créer un template</Link>
                  </Button>
                }
              />
            }
          />
        </CardContent>
      </Card>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce template ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les coupons existants basés sur ce
              template ne seront pas affectés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
