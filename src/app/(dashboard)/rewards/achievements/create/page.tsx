"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  createAchievementBadge,
  reawardAchievementBadge,
} from "@/lib/services/achievementBadgeService";
import { achievementBadgeKeys } from "@/lib/queries/keys";
import { AchievementBadgeForm } from "../_form/AchievementBadgeForm";

export default function CreateAchievementBadgePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/rewards/achievements">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Nouveau badge succès</h1>
          <p className="text-muted-foreground">
            Le badge sera attribué rétroactivement aux joueurs éligibles après création.
          </p>
        </div>
      </div>

      <AchievementBadgeForm
        submitLabel="Créer le badge"
        onCancel={() => router.push("/rewards/achievements")}
        onSubmit={async (payload) => {
          const created = await createAchievementBadge(payload);
          try {
            const res = await reawardAchievementBadge(created.id);
            toast.success("Badge créé", {
              description: `${res.awarded_count} joueur(s) éligible(s) ont reçu ce badge.`,
            });
          } catch (err) {
            console.error(err);
            toast.error("Badge créé mais réévaluation échouée", {
              description: "Tu peux relancer l'attribution depuis la page d'édition.",
            });
          }
          queryClient.invalidateQueries({ queryKey: achievementBadgeKeys.all });
          router.push("/rewards/achievements");
        }}
      />
    </div>
  );
}
