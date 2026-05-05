"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Plus,
  Settings,
  Calendar,
  PlayCircle,
  Loader2,
  Trophy,
  Medal,
  Award,
  BookOpen,
  Pencil,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getRewardTiers, updateRewardTier, getBadgeTypes, updateBadgeType } from "@/lib/services/rewardService";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import type { RewardTier, PeriodType, BadgeType } from "@/types/database";

type RewardTierWithRelations = RewardTier & {
  coupon_templates: { name: string; amount: number | null; percentage: number | null } | null;
  badge_types: { name: string } | null;
};

const periodLabels: Record<PeriodType, string> = {
  weekly: "Hebdomadaire",
  monthly: "Mensuel",
  yearly: "Annuel",
};

const rankIcons = {
  1: Trophy,
  2: Medal,
  3: Award,
};

export default function RewardsPage() {
  const [tiers, setTiers] = useState<RewardTierWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("weekly");
  const [badges, setBadges] = useState<BadgeType[]>([]);
  const [editingBadge, setEditingBadge] = useState<BadgeType | null>(null);
  const [badgeLore, setBadgeLore] = useState("");
  const [savingLore, setSavingLore] = useState(false);
  const { toast } = useToast();

  const fetchTiers = useCallback(async () => {
    try {
      const data = await getRewardTiers();
      setTiers(data as RewardTierWithRelations[]);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les paliers",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const data = await getBadgeTypes();
        setBadges(data);
      } catch (error) {
        console.error(error);
      }
    };
    fetchBadges();
  }, []);

  const handleSaveBadgeLore = async () => {
    if (!editingBadge) return;
    setSavingLore(true);
    try {
      await updateBadgeType(editingBadge.id, { lore: badgeLore || null });
      setBadges((prev) =>
        prev.map((b) => (b.id === editingBadge.id ? { ...b, lore: badgeLore || null } : b))
      );
      toast({ title: "Lore du badge mis à jour" });
      setEditingBadge(null);
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de modifier le lore" });
    } finally {
      setSavingLore(false);
    }
  };

  const handleToggleActive = async (id: number, isActive: boolean) => {
    try {
      await updateRewardTier(id, { is_active: isActive });
      setTiers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_active: isActive } : t))
      );
      toast({
        title: isActive ? "Palier active" : "Palier désactivé",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de modifier le palier",
      });
    }
  };

  const filteredTiers = tiers.filter((t) => t.period_type === selectedPeriod);

  if (loading) {
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
          <h1 className="text-3xl font-bold">Récompenses</h1>
          <p className="text-muted-foreground">
            Configurez les paliers de récompenses du leaderboard
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/rewards/periods">
            <Button variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              Périodes
            </Button>
          </Link>
          <Link href="/rewards/distribute">
            <Button variant="outline">
              <PlayCircle className="mr-2 h-4 w-4" />
              Distribuer
            </Button>
          </Link>
          <Link href="/rewards/tiers/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau palier
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Paliers de récompenses</CardTitle>
          <CardDescription>
            Définissez les récompenses pour chaque rang du leaderboard
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
                  Aucun palier configure pour cette periode
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
                    {filteredTiers
                      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
                      .map((tier) => {
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
                                      ? formatCurrency(tier.coupon_templates.amount)
                                      : tier.coupon_templates.percentage
                                      ? formatPercentage(
                                          tier.coupon_templates.percentage
                                        )
                                      : "-"}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">
                                  Non configure
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
                                  handleToggleActive(tier.id, checked)
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
            Ajoutez un texte narratif aux badges affichés côté client
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                    {badge.lore || <span className="italic">Aucun lore</span>}
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
        </CardContent>
      </Card>

      <Dialog open={!!editingBadge} onOpenChange={(open) => !open && setEditingBadge(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le lore de &quot;{editingBadge?.name}&quot;</DialogTitle>
            <DialogDescription>
              Texte narratif affiché dans la modale du badge côté client
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
            <Button onClick={handleSaveBadgeLore} disabled={savingLore}>
              {savingLore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
