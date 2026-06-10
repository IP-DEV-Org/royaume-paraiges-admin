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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, Plus, Trash2, CheckCircle, Clock, XCircle } from "lucide-react";
import {
  getPeriodConfig,
  getRewardTiers,
  createOrUpdatePeriodConfig,
} from "@/lib/services/rewardService";
import { getActiveTemplates } from "@/lib/services/templateService";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import { toast } from "sonner";
import type {
  PeriodRewardConfig,
  RewardTier,
  CouponTemplate,
  PeriodType,
  Json,
  DistributionStatus,
} from "@/types/database";

interface CustomTier {
  rank_from: number;
  rank_to: number;
  coupon_template_id: number | null;
  badge_type_id: number | null;
}

const periodLabels: Record<PeriodType, string> = {
  weekly: "Hebdomadaire",
  monthly: "Mensuel",
  yearly: "Annuel",
};

const statusConfig: Record<
  DistributionStatus,
  { label: string; variant: "default" | "success" | "destructive" | "warning"; icon: typeof Clock }
> = {
  pending: { label: "En attente", variant: "warning", icon: Clock },
  distributed: { label: "Distribue", variant: "success", icon: CheckCircle },
  cancelled: { label: "Annule", variant: "destructive", icon: XCircle },
  failed: { label: "Echoue", variant: "destructive", icon: XCircle },
};

export default function PeriodConfigPage() {
  const router = useRouter();
  const params = useParams();

  const periodType = params.periodType as PeriodType;
  const periodIdentifier = decodeURIComponent(params.identifier as string);

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [config, setConfig] = useState<PeriodRewardConfig | null>(null);
  const [defaultTiers, setDefaultTiers] = useState<RewardTier[]>([]);
  const [templates, setTemplates] = useState<CouponTemplate[]>([]);

  const [useCustomTiers, setUseCustomTiers] = useState(false);
  const [customTiers, setCustomTiers] = useState<CustomTier[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [configData, tiersData, templatesData] = await Promise.all([
          getPeriodConfig(periodType, periodIdentifier),
          getRewardTiers(periodType),
          getActiveTemplates(),
        ]);

        setDefaultTiers(tiersData.filter((t) => t.is_active));
        setTemplates(templatesData || []);

        if (configData) {
          setConfig(configData);
          setNotes(configData.notes || "");

          if (configData.custom_tiers) {
            setUseCustomTiers(true);
            setCustomTiers(configData.custom_tiers as unknown as CustomTier[]);
          }
        }
      } catch (error) {
        toast.error("Erreur", {
          description: "Impossible de charger la configuration",
        });
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [periodType, periodIdentifier]);

  const handleAddTier = () => {
    const lastTier = customTiers[customTiers.length - 1];
    const newRankFrom = lastTier ? lastTier.rank_to + 1 : 1;

    setCustomTiers([
      ...customTiers,
      {
        rank_from: newRankFrom,
        rank_to: newRankFrom,
        coupon_template_id: null,
        badge_type_id: null,
      },
    ]);
  };

  const handleRemoveTier = (index: number) => {
    setCustomTiers(customTiers.filter((_, i) => i !== index));
  };

  const handleUpdateTier = (index: number, updates: Partial<CustomTier>) => {
    setCustomTiers(
      customTiers.map((tier, i) => (i === index ? { ...tier, ...updates } : tier))
    );
  };

  const handleUseDefaultTiers = () => {
    if (defaultTiers.length > 0) {
      setCustomTiers(
        defaultTiers.map((t) => ({
          rank_from: t.rank_from,
          rank_to: t.rank_to,
          coupon_template_id: t.coupon_template_id,
          badge_type_id: t.badge_type_id,
        }))
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tiersToSave: Json | null = useCustomTiers ? (customTiers as unknown as Json) : null;

      await createOrUpdatePeriodConfig(
        periodType,
        periodIdentifier,
        tiersToSave,
        notes || undefined
      );

      toast.success("Configuration enregistrée");
      router.push("/rewards/periods");
    } catch (error) {
      toast.error("Erreur", {
        description: "Impossible d'enregistrer la configuration",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const status = config?.status ? statusConfig[config.status as DistributionStatus] : null;
  const StatusIcon = status?.icon;
  const isDistributed = config?.status === "distributed";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/rewards/periods">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">
              {periodLabels[periodType]} - {periodIdentifier}
            </h1>
            <p className="text-muted-foreground">
              Configuration des recompenses pour cette periode
            </p>
          </div>
        </div>
        {status && StatusIcon && (
          <Badge variant={status.variant as "default"}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {status.label}
          </Badge>
        )}
      </div>

      {isDistributed && (
        <Card className="border-warning bg-warning/10">
          <CardContent className="pt-6">
            <p className="text-sm text-warning-foreground">
              Cette periode a déjà ete distribuee. Les modifications n&apos;affecteront
              pas les recompenses déjà attribuees.
            </p>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              <CardDescription>
                Ajoutez des notes pour documenter cette configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Ex: Configuration speciale pour l'anniversaire du Royaume"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </CardContent>
          </Card>

          {/* Configuration des paliers */}
          <Card>
            <CardHeader>
              <CardTitle>Paliers de recompenses</CardTitle>
              <CardDescription>
                Utilisez les paliers par défaut ou definissez une configuration
                personnalisée pour cette periode
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Utiliser une configuration personnalisée</Label>
                  <p className="text-sm text-muted-foreground">
                    Definir des paliers spécifiques pour cette periode
                  </p>
                </div>
                <Switch
                  checked={useCustomTiers}
                  onCheckedChange={(checked) => {
                    setUseCustomTiers(checked);
                    if (checked && customTiers.length === 0) {
                      handleUseDefaultTiers();
                    }
                  }}
                />
              </div>

              {!useCustomTiers ? (
                <div className="rounded-lg border p-4">
                  <h4 className="font-medium mb-2">Paliers par défaut</h4>
                  {defaultTiers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aucun palier par défaut configure pour ce type de periode
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {defaultTiers.map((tier) => (
                        <div
                          key={tier.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span>
                            <strong>{tier.name}</strong> (Rangs {tier.rank_from}
                            {tier.rank_from !== tier.rank_to && ` - ${tier.rank_to}`})
                          </span>
                          <span className="text-muted-foreground">
                            { }
                            {(tier as any).coupon_templates?.name || "Pas de coupon"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Paliers personnalises</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddTier}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter un palier
                    </Button>
                  </div>

                  {customTiers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aucun palier configure. Cliquez sur &quot;Ajouter un palier&quot;
                      pour commencer.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {customTiers.map((tier, index) => (
                        <div
                          key={index}
                          className="rounded-lg border p-4 space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Palier {index + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveTier(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>

                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label>Rang minimum</Label>
                              <Input
                                type="number"
                                min={1}
                                value={tier.rank_from}
                                onChange={(e) =>
                                  handleUpdateTier(index, {
                                    rank_from: parseInt(e.target.value) || 1,
                                  })
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Rang maximum</Label>
                              <Input
                                type="number"
                                min={tier.rank_from}
                                value={tier.rank_to}
                                onChange={(e) =>
                                  handleUpdateTier(index, {
                                    rank_to: parseInt(e.target.value) || tier.rank_from,
                                  })
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Template de coupon</Label>
                              <Select
                                value={tier.coupon_template_id?.toString() || "none"}
                                onValueChange={(value) =>
                                  handleUpdateTier(index, {
                                    coupon_template_id:
                                      value === "none" ? null : parseInt(value),
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionner" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Aucun coupon</SelectItem>
                                  {templates.map((template) => (
                                    <SelectItem
                                      key={template.id}
                                      value={template.id.toString()}
                                    >
                                      {template.name}
                                      {template.amount
                                        ? ` (${formatCurrency(template.amount)})`
                                        : template.percentage
                                        ? ` (${formatPercentage(template.percentage)})`
                                        : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Link href="/rewards/periods">
              <Button type="button" variant="outline">
                Annuler
              </Button>
            </Link>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
