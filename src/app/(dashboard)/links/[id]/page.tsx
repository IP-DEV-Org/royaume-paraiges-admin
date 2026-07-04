"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getRedirectLink,
  deleteRedirectLink,
  buildShortUrl,
} from "@/lib/services/redirectLinkService";
import { redirectLinkKeys } from "@/lib/queries/keys";
import { LinkForm } from "../_form/LinkForm";
import { LinkQrCard } from "./_components/link-qr-card";
import { LinkStats } from "./_components/link-stats";

export default function LinkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const linkQuery = useQuery({
    queryKey: redirectLinkKeys.detail(id),
    queryFn: () => getRedirectLink(id),
  });

  const link = linkQuery.data;

  const onDelete = async () => {
    if (!link) return;
    setDeleting(true);
    try {
      await deleteRedirectLink(link.id);
      queryClient.invalidateQueries({ queryKey: redirectLinkKeys.all });
      toast.success(`Lien /${link.slug} supprimé`);
      router.push("/links");
    } catch (err) {
      console.error(err);
      toast.error("Erreur", {
        description: "Impossible de supprimer le lien",
      });
      setDeleting(false);
    }
  };

  if (linkQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-9 w-64 animate-pulse rounded bg-muted" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-[480px] animate-pulse rounded-lg bg-muted lg:col-span-2" />
          <div className="h-[360px] animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (!link) {
    return (
      <Card>
        <CardContent className="py-10">
          <EmptyState
            title="Lien introuvable"
            description="Ce lien de redirection n'existe pas ou a été supprimé."
            action={
              <Button asChild>
                <Link href="/links">Retour aux liens</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/links">
          <Button variant="ghost" size="icon" aria-label="Retour aux liens">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-bold">{link.label}</h1>
          <a
            href={buildShortUrl(link.slug)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
          >
            {buildShortUrl(link.slug)}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirmDelete(true)}
          disabled={deleting}
        >
          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
          Supprimer
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LinkForm link={link} />
        </div>
        <LinkQrCard slug={link.slug} />
      </div>

      <LinkStats linkId={link.id} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Supprimer /${link.slug} ?`}
        description="Le lien et tout son historique de clics seront définitivement supprimés. Les QR codes déjà imprimés redirigeront vers auxparaiges.fr. Pour une coupure temporaire, préférez la désactivation."
        confirmLabel="Supprimer"
        destructive
        onConfirm={onDelete}
      />
    </div>
  );
}
