"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { achievementBadgeKeys } from "@/lib/queries/keys";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Archive, RefreshCw, Loader2 } from "lucide-react";
import {
  archiveAchievementBadge,
  getAchievementBadge,
  reawardAchievementBadge,
  updateAchievementBadge,
  type AchievementBadge,
} from "@/lib/services/achievementBadgeService";
import { AchievementBadgeForm } from "../_form/AchievementBadgeForm";

export default function EditAchievementBadgePage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [badge, setBadge] = useState<AchievementBadge | null>(null);
  const [loading, setLoading] = useState(true);
  const [reawarding, setReawarding] = useState(false);

  useEffect(() => {
    if (!id) return;
    getAchievementBadge(id)
      .then(setBadge)
      .catch((err) => {
        console.error(err);
        toast.error("Erreur", { description: "Badge introuvable" });
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!badge) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Badge introuvable.</p>
      </div>
    );
  }

  const criterionParams = (badge.criterion_params || {}) as Record<string, unknown>;
  const threshold = criterionParams.threshold?.toString() ?? "";
  const minCities = criterionParams.min_cities?.toString() ?? "";
  const nWeeks = criterionParams.n_weeks?.toString() ?? "";

  const handleReaward = async () => {
    setReawarding(true);
    try {
      const res = await reawardAchievementBadge(badge.id);
      toast.success("Réévaluation terminée", {
        description: `${res.awarded_count} nouveau(x) déblocage(s).`,
      });
    } catch (err) {
      console.error(err);
      toast.error("Échec de la réévaluation", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setReawarding(false);
    }
  };

  const handleArchive = async () => {
    try {
      await archiveAchievementBadge(badge.id);
      queryClient.invalidateQueries({ queryKey: achievementBadgeKeys.all });
      toast.success("Badge archivé");
      router.push("/rewards/achievements");
    } catch (err) {
      console.error(err);
      toast.error("Erreur", { description: "Impossible d'archiver le badge" });
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/rewards/achievements">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Modifier le badge succès</h1>
            <p className="text-muted-foreground font-mono text-sm">{badge.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReaward}
            disabled={reawarding}
          >
            {reawarding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Réévaluer pour tous
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Archive className="mr-2 h-4 w-4" />
                Archiver
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archiver ce badge ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Le badge ne sera plus attribuable. Les joueurs qui l&apos;ont
                  déjà obtenu continueront à le voir dans leur collection.
                  Cette action n&apos;est pas une suppression définitive —
                  elle peut être levée via SQL si nécessaire.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleArchive}>
                  Archiver
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <AchievementBadgeForm
        lockSlug
        initial={{
          slug: badge.slug,
          name: badge.name,
          description: badge.description ?? "",
          lore: badge.lore ?? "",
          icon: badge.icon ?? "🏅",
          rarity: badge.rarity ?? "common",
          criterion_type: badge.criterion_type ?? "first_order",
          evaluation_mode: badge.evaluation_mode,
          threshold,
          min_cities: minCities,
          n_weeks: nWeeks,
        }}
        submitLabel="Enregistrer"
        onCancel={() => router.push("/rewards/achievements")}
        onSubmit={async (payload) => {
          await updateAchievementBadge(badge.id, payload);
          queryClient.invalidateQueries({ queryKey: achievementBadgeKeys.all });
          toast.success("Badge mis à jour");
          router.push("/rewards/achievements");
        }}
      />
    </div>
  );
}
