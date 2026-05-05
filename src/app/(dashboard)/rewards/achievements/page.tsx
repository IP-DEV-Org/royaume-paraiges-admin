"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Loader2, Medal } from "lucide-react";
import { listAchievementBadges } from "@/lib/services/achievementBadgeService";
import { achievementBadgeKeys } from "@/lib/queries/keys";

const RARITY_COLORS: Record<string, string> = {
  common: "bg-slate-100 text-slate-800",
  rare: "bg-blue-100 text-blue-800",
  epic: "bg-purple-100 text-purple-800",
  legendary: "bg-amber-100 text-amber-800",
};

const CRITERION_LABELS: Record<string, string> = {
  first_order: "Première commande",
  orders_threshold: "Nombre de commandes",
  cities_visited: "Nombre de villes",
  all_establishments_visited: "Tous les établissements",
  consecutive_weekly_quests: "Quêtes hebdo consécutives",
  establishments_threshold: "Nombre d'établissements",
};

export default function AchievementBadgesPage() {
  const router = useRouter();

  const {
    data: badges = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: achievementBadgeKeys.lists(),
    queryFn: listAchievementBadges,
  });

  useEffect(() => {
    if (error) {
      console.error(error);
      toast.error("Erreur", {
        description: "Impossible de charger les badges succès",
      });
    }
  }, [error]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Badges succès</h1>
          <p className="text-muted-foreground">
            Débloqués automatiquement par les joueurs selon un critère paramétrable.
          </p>
        </div>
        <Link href="/rewards/achievements/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau badge
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des badges</CardTitle>
          <CardDescription>
            Les badges archivés ne sont plus attribués mais restent visibles
            dans la collection des utilisateurs qui les ont déjà obtenus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {badges.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground border rounded-lg">
              <Medal className="mx-auto h-10 w-10 mb-3 opacity-40" />
              <p>Aucun badge succès configuré pour l&apos;instant.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Badge</TableHead>
                  <TableHead>Critère</TableHead>
                  <TableHead>Rareté</TableHead>
                  <TableHead>Mode</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {badges.map((badge) => (
                  <TableRow
                    key={badge.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/rewards/achievements/${badge.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{badge.icon ?? "🏅"}</span>
                        <div>
                          <p className="font-medium">{badge.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {badge.slug}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline" className="text-xs">
                          {CRITERION_LABELS[badge.criterion_type ?? ""] ??
                            badge.criterion_type}
                        </Badge>
                        {Object.keys(badge.criterion_params).length > 0 && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {JSON.stringify(badge.criterion_params)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${RARITY_COLORS[badge.rarity ?? "common"]} text-xs`}
                      >
                        {badge.rarity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {badge.evaluation_mode === "realtime"
                          ? "Temps réel"
                          : "Cron nocturne"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
