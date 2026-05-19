"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Settings,
  Loader2,
  Trophy,
  Medal,
  Award,
  BookOpen,
  Pencil,
  ArrowLeft,
} from "lucide-react";
import {
  getRewardTiers,
  updateRewardTier,
  getBadgeTypes,
  updateBadgeType,
} from "@/lib/services/rewardService";
import { badgeTypeKeys, rewardTierKeys } from "@/lib/queries/keys";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import type { RewardTier, PeriodType, BadgeType } from "@/types/database";

type RewardTierWithRelations = RewardTier & {
  coupon_templates: {
    name: string;
    amount: number | null;
    percentage: number | null;
  } | null;
  badge_types: { name: string } | null;
};

const rankIcons = {
  1: Trophy,
  2: Medal,
  3: Award,
};

export default function RewardTiersPage() {
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("weekly");
  const [editingBadge, setEditingBadge] = useState<BadgeType | null>(null);
  const [badgeLore, setBadgeLore] = useState("");

  const { data: tiers = [], isLoading: tiersLoading } = useQuery({
    queryKey: rewardTierKeys.lists(),
    queryFn: () => getRewardTiers() as Promise<RewardTierWithRelations[]>,
  });

  const { data: badges = [] } = useQuery({
    queryKey: badgeTypeKeys.lists(),
    queryFn: getBadgeTypes,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      updateRewardTier(id, { is_active: isActive }),
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: rewardTierKeys.all });
      toast.success(isActive ? "Palier activé" : "Palier désactivé");
    },
    onError: () => {
      toast.error("Impossible de modifier le palier");
    },
  });

  const updateLoreMutation = useMutation({
    mutationFn: ({ id, lore }: { id: number; lore: string | null }) =>
      updateBadgeType(id, { lore }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: badgeTypeKeys.all });
      toast.success("Lore du badge mis à jour");
      setEditingBadge(null);
    },
    onError: () => {
      toast.error("Impossible de modifier le lore");
    },
  });

  const filteredTiers = tiers
    .filter((t) => t.period_type === selectedPeriod)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  if (tiersLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            href="/rewards"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-3 w-3" />
            Récompenses
          </Link>
          <h1 className="text-3xl font-bold">Paliers du leaderboard</h1>
          <p className="text-muted-foreground">
            Configurez les coupons et badges distribués aux meilleurs joueurs de
            chaque période.
          </p>
        </div>
        <Link href="/rewards/tiers/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau palier
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Paliers</CardTitle>
          <CardDescription>
            Définissez les récompenses pour chaque rang du classement.
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
              {filteredTiers.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  Aucun palier configuré pour cette période.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Palier</TableHead>
                      <TableHead>Rangs</TableHead>
                      <TableHead>Coupon</TableHead>
                      <TableHead>Badge</TableHead>
                      <TableHead>Actif</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTiers.map((tier) => {
                      const Icon =
                        rankIcons[tier.rank_from as keyof typeof rankIcons];

                      return (
                        <TableRow key={tier.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {Icon && (
                                <Icon className="h-5 w-5 text-yellow-500" />
                              )}
                              <span className="font-medium">{tier.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {tier.rank_from === tier.rank_to
                              ? `Rang ${tier.rank_from}`
                              : `Rangs ${tier.rank_from} - ${tier.rank_to}`}
                          </TableCell>
                          <TableCell>
                            {tier.coupon_templates ? (
                              <div>
                                <p className="font-medium">
                                  {tier.coupon_templates.name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {tier.coupon_templates.amount
                                    ? formatCurrency(
                                        tier.coupon_templates.amount
                                      )
                                    : tier.coupon_templates.percentage
                                    ? formatPercentage(
                                        tier.coupon_templates.percentage
                                      )
                                    : "-"}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                Non configuré
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {tier.badge_types?.name || (
                              <span className="text-muted-foreground">
                                Aucun
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={tier.is_active ?? false}
                              onCheckedChange={(checked) =>
                                toggleActiveMutation.mutate({
                                  id: tier.id,
                                  isActive: checked,
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Link href={`/rewards/tiers/${tier.id}`}>
                              <Button variant="ghost" size="sm">
                                <Settings className="h-4 w-4" />
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Lore des badges
          </CardTitle>
          <CardDescription>
            Texte narratif affiché aux joueurs dans la fiche du badge.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {badges.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Aucun badge configuré.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Badge</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Rareté</TableHead>
                  <TableHead>Lore</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {badges.map((badge) => (
                  <TableRow key={badge.id}>
                    <TableCell className="font-medium">{badge.name}</TableCell>
                    <TableCell>{badge.category || "-"}</TableCell>
                    <TableCell>{badge.rarity || "-"}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-muted-foreground">
                      {badge.lore || (
                        <span className="italic">Aucun lore</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingBadge(badge);
                          setBadgeLore(badge.lore || "");
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!editingBadge}
        onOpenChange={(open) => !open && setEditingBadge(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Modifier le lore de &quot;{editingBadge?.name}&quot;
            </DialogTitle>
            <DialogDescription>
              Texte narratif affiché dans la modale du badge côté client.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={badgeLore}
            onChange={(e) => setBadgeLore(e.target.value)}
            placeholder="Ex: Seuls les champions de la semaine peuvent arborer cet insigne..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBadge(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (!editingBadge) return;
                updateLoreMutation.mutate({
                  id: editingBadge.id,
                  lore: badgeLore || null,
                });
              }}
              disabled={updateLoreMutation.isPending}
            >
              {updateLoreMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
