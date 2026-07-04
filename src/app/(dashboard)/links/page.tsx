"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Copy, Link2, Plus, Smartphone } from "lucide-react";
import {
  getRedirectLinks,
  updateRedirectLink,
  buildShortUrl,
  REDIRECT_BASE_URL,
} from "@/lib/services/redirectLinkService";
import { redirectLinkKeys } from "@/lib/queries/keys";
import { formatDateTime } from "@/lib/utils";
import type { RedirectLinkWithStats } from "@/types/database";

export default function LinksPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const limit = 20;

  const linksQuery = useQuery({
    queryKey: redirectLinkKeys.lists(),
    queryFn: getRedirectLinks,
  });

  const links = linksQuery.data ?? [];
  const totalPages = Math.ceil(links.length / limit);
  const paginated = links.slice(page * limit, (page + 1) * limit);

  const copyShortUrl = async (slug: string) => {
    await navigator.clipboard.writeText(buildShortUrl(slug));
    toast.success("URL copiée", { description: buildShortUrl(slug) });
  };

  const toggleActive = async (link: RedirectLinkWithStats) => {
    try {
      await updateRedirectLink(link.id, { is_active: !link.is_active });
      queryClient.invalidateQueries({ queryKey: redirectLinkKeys.all });
      toast.success(
        link.is_active ? `/${link.slug} désactivé` : `/${link.slug} activé`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Erreur", {
        description: "Impossible de modifier le statut du lien",
      });
    }
  };

  const columns: DataTableColumn<RedirectLinkWithStats>[] = [
    {
      key: "slug",
      header: "URL courte",
      sortable: true,
      sortValue: (item) => item.slug,
      cell: (item) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-sm font-medium">/{item.slug}</span>
          <div onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={`Copier ${buildShortUrl(item.slug)}`}
              onClick={() => copyShortUrl(item.slug)}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ),
    },
    {
      key: "label",
      header: "Nom",
      sortable: true,
      sortValue: (item) => item.label,
      cell: (item) => (
        <div>
          <span className="font-medium">{item.label}</span>
          {item.description && (
            <p className="max-w-[240px] truncate text-sm text-muted-foreground">
              {item.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "target",
      header: "Destination",
      cell: (item) => (
        <div className="flex items-center gap-2">
          <span className="max-w-[280px] truncate text-sm text-muted-foreground">
            {item.target_url}
          </span>
          {(item.target_url_ios || item.target_url_android) && (
            <Badge variant="outline" className="shrink-0 gap-1">
              <Smartphone className="h-3 w-3" aria-hidden="true" />
              Smart link
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "total_clicks",
      header: "Clics",
      sortable: true,
      sortValue: (item) => item.total_clicks,
      cellClassName: "font-medium tabular-nums",
      cell: (item) => <>{item.total_clicks}</>,
    },
    {
      key: "last_click_at",
      header: "Dernier clic",
      sortable: true,
      sortValue: (item) => item.last_click_at,
      cellClassName: "text-sm text-muted-foreground",
      cell: (item) =>
        item.last_click_at ? formatDateTime(item.last_click_at) : "—",
    },
    {
      key: "is_active",
      header: "Actif",
      sortable: true,
      sortValue: (item) => (item.is_active ? 1 : 0),
      cell: (item) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={item.is_active}
            onCheckedChange={() => toggleActive(item)}
            aria-label={`Activer ou désactiver /${item.slug}`}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Liens de redirection"
        description={`URLs courtes ${REDIRECT_BASE_URL.replace("https://", "")}/… pour les QR codes imprimés — cibles modifiables à chaud.`}
        actions={
          <Link href="/links/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Nouveau lien
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Liens</CardTitle>
          <CardDescription>
            {links.length} lien{links.length > 1 ? "s" : ""} — cliquer sur une
            ligne pour le QR code et les statistiques.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={paginated}
            rowKey={(item) => item.id}
            loading={linksQuery.isLoading}
            onRowClick={(item) => router.push(`/links/${item.id}`)}
            emptyState={
              <EmptyState
                icon={Link2}
                title="Aucun lien de redirection"
                description="Créez votre premier lien court pour générer son QR code."
                action={
                  <Button asChild>
                    <Link href="/links/create">Créer un lien</Link>
                  </Button>
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
