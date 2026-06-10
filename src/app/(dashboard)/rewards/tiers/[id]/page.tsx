"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import {
  getRewardTier,
  updateRewardTier,
  deleteRewardTier,
  getBadgeTypes,
} from "@/lib/services/rewardService";
import { getActiveTemplates } from "@/lib/services/templateService";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
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
import type { BadgeType, CouponTemplate, PeriodType } from "@/types/database";

export default function EditTierPage() {
  const router = useRouter();
  const params = useParams();
  const id = parseInt(params.id as string);

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [templates, setTemplates] = useState<CouponTemplate[]>([]);
  const [badgeTypes, setBadgeTypes] = useState<BadgeType[]>([]);

  const [form, setForm] = useState({
    name: "",
    periodType: "weekly" as PeriodType,
    rankFrom: "",
    rankTo: "",
    couponTemplateId: "none",
    badgeTypeId: "none",
    displayOrder: "0",
    isActive: true,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tier, templatesData, badgeTypesData] = await Promise.all([
          getRewardTier(id),
          getActiveTemplates(),
          getBadgeTypes(),
        ]);

        setTemplates(templatesData || []);
        setBadgeTypes(badgeTypesData || []);

        if (tier) {
          setForm({
            name: tier.name,
            periodType: tier.period_type as PeriodType,
            rankFrom: tier.rank_from.toString(),
            rankTo: tier.rank_to.toString(),
            couponTemplateId: tier.coupon_template_id?.toString() || "none",
            badgeTypeId: tier.badge_type_id?.toString() || "none",
            displayOrder: (tier.display_order ?? 0).toString(),
            isActive: tier.is_active ?? true,
          });
        }
      } catch (error) {
        toast.error("Erreur", {
          description: "Impossible de charger le palier",
        });
        router.push("/rewards");
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateRewardTier(id, {
        name: form.name,
        period_type: form.periodType,
        rank_from: parseInt(form.rankFrom),
        rank_to: parseInt(form.rankTo),
        coupon_template_id: form.couponTemplateId && form.couponTemplateId !== "none"
          ? parseInt(form.couponTemplateId)
          : null,
        badge_type_id: form.badgeTypeId && form.badgeTypeId !== "none"
          ? parseInt(form.badgeTypeId)
          : null,
        display_order: parseInt(form.displayOrder),
        is_active: form.isActive,
      });
      toast.success("Palier mis à jour");
      router.push("/rewards");
    } catch (error) {
      toast.error("Erreur", {
        description: "Impossible de mettre a jour le palier",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteRewardTier(id);
      toast.success("Palier supprime");
      router.push("/rewards");
    } catch (error) {
      toast.error("Erreur", {
        description: "Impossible de supprimer le palier",
      });
    }
  };

  if (loadingData) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/rewards">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Modifier le palier</h1>
            <p className="text-muted-foreground">{form.name}</p>
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce palier ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Configuration du palier</CardTitle>
            <CardDescription>
              Modifiez les rangs et les récompenses associees
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du palier *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Champion, Podium, Top 10"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Type de periode *</Label>
                <Select
                  value={form.periodType}
                  onValueChange={(value: PeriodType) =>
                    setForm({ ...form, periodType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Hebdomadaire</SelectItem>
                    <SelectItem value="monthly">Mensuel</SelectItem>
                    <SelectItem value="yearly">Annuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="rankFrom">Rang minimum *</Label>
                <Input
                  id="rankFrom"
                  type="number"
                  value={form.rankFrom}
                  onChange={(e) => setForm({ ...form, rankFrom: e.target.value })}
                  required
                  min={1}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rankTo">Rang maximum *</Label>
                <Input
                  id="rankTo"
                  type="number"
                  value={form.rankTo}
                  onChange={(e) => setForm({ ...form, rankTo: e.target.value })}
                  required
                  min={1}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayOrder">Ordre d&apos;affichage</Label>
                <Input
                  id="displayOrder"
                  type="number"
                  value={form.displayOrder}
                  onChange={(e) =>
                    setForm({ ...form, displayOrder: e.target.value })
                  }
                  min={0}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Template de coupon</Label>
              <Select
                value={form.couponTemplateId}
                onValueChange={(value) =>
                  setForm({ ...form, couponTemplateId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun coupon</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id.toString()}>
                      {template.name}
                      {template.amount
                        ? ` (${formatCurrency(template.amount)} - Bonus CB)`
                        : template.percentage
                        ? ` (${template.percentage}% - Coupon)`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Badge</Label>
              <Select
                value={form.badgeTypeId}
                onValueChange={(value) =>
                  setForm({ ...form, badgeTypeId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un badge" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun badge</SelectItem>
                  {badgeTypes
                    .filter((bt) => {
                      const categoryMap: Record<PeriodType, string> = {
                        weekly: "weekly",
                        monthly: "monthly",
                        yearly: "yearly",
                      };
                      return !bt.category || bt.category === categoryMap[form.periodType];
                    })
                    .map((bt) => (
                      <SelectItem key={bt.id} value={bt.id.toString()}>
                        {bt.name}
                        {bt.rarity ? ` (${bt.rarity})` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Palier actif</Label>
                <p className="text-sm text-muted-foreground">
                  Sera utilise lors des distributions
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm({ ...form, isActive: checked })
                }
              />
            </div>

            <div className="flex justify-end gap-4">
              <Link href="/rewards">
                <Button type="button" variant="outline">
                  Annuler
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
