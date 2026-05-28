"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Loader2, X } from "lucide-react";
import { PeriodCalendar } from "@/components/period-calendar";
import { EstablishmentsPicker } from "@/components/establishments-picker";
import { getActiveTemplates } from "@/lib/services/templateService";
import {
  getAvailablePeriodsByType,
  getCurrentPeriodIdentifier,
} from "@/lib/services/periodService";
import { formatCurrency } from "@/lib/utils";
import type {
  CouponTemplate,
  PeriodType,
  QuestType,
  AvailablePeriod,
  ConsumptionType,
} from "@/types/database";

const CONSUMPTION_TYPES: { value: ConsumptionType; label: string }[] = [
  { value: "biere", label: "Bières" },
  { value: "cocktail", label: "Cocktails" },
  { value: "alcool", label: "Alcools" },
  { value: "soft", label: "Sodas / softs" },
  { value: "boisson_chaude", label: "Boissons chaudes" },
  { value: "restauration", label: "Restauration" },
  { value: "boucherie", label: "Boucherie" },
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const NONE_TEMPLATE = "none";

const formSchema = z
  .object({
    name: z.string().min(1, "Le nom est requis.").max(200),
    description: z.string().max(1000),
    lore: z.string().max(2000),
    slug: z
      .string()
      .min(1, "Le slug est requis.")
      .regex(/^[a-z0-9_]+$/, "Slug : uniquement [a-z0-9_]."),
    questType: z.enum([
      "xp_earned",
      "cashback_earned",
      "amount_spent",
      "establishments_visited",
      "orders_count",
      "quest_completed",
      "consumption_count",
    ]),
    consumptionType: z.enum([
      "",
      "cocktail",
      "biere",
      "alcool",
      "soft",
      "boisson_chaude",
      "restauration",
      "boucherie",
    ]),
    targetValue: z.string().min(1, "Objectif requis."),
    periodType: z.enum(["weekly", "monthly", "yearly"]),
    couponTemplateId: z.string(),
    bonusXp: z.string(),
    bonusCashback: z.string(),
    displayOrder: z.string(),
    isActive: z.boolean(),
    periods: z.array(z.string()),
    establishments: z.array(z.number()),
  })
  .superRefine((data, ctx) => {
    if (data.questType === "consumption_count" && !data.consumptionType) {
      ctx.addIssue({
        code: "custom",
        message: "Sélectionnez le type de produit à compter.",
        path: ["consumptionType"],
      });
    }
    if (data.questType === "quest_completed" && data.periodType === "weekly") {
      ctx.addIssue({
        code: "custom",
        message: "« Compléter des quêtes » incompatible avec hebdomadaire.",
        path: ["periodType"],
      });
    }
    const target =
      data.questType === "amount_spent"
        ? parseFloat(data.targetValue)
        : parseInt(data.targetValue, 10);
    if (isNaN(target) || target <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "L'objectif doit être un nombre strictement positif.",
        path: ["targetValue"],
      });
    }

    const hasReward =
      (data.couponTemplateId && data.couponTemplateId !== NONE_TEMPLATE) ||
      (data.bonusXp && parseInt(data.bonusXp, 10) > 0) ||
      (data.bonusCashback && parseFloat(data.bonusCashback) > 0);
    if (!hasReward) {
      ctx.addIssue({
        code: "custom",
        message: "Configurez au moins une récompense (coupon, XP, ou cashback).",
        path: ["bonusXp"],
      });
    }
  });

export type QuestFormInput = z.infer<typeof formSchema>;

export interface QuestFormPayload {
  name: string;
  description: string | null;
  lore: string | null;
  slug: string;
  quest_type: QuestType;
  consumption_type: ConsumptionType | null;
  target_value: number;
  period_type: PeriodType;
  coupon_template_id: number | null;
  bonus_xp: number;
  bonus_cashback: number;
  display_order: number;
  is_active: boolean;
  periods: string[];
  establishments: number[];
}

interface Props {
  initial?: Partial<QuestFormInput>;
  submitLabel: string;
  cancelHref: string;
  mode: "create" | "edit";
  onSubmit: (payload: QuestFormPayload) => Promise<void>;
}

export function QuestForm({
  initial,
  submitLabel,
  cancelHref,
  mode,
  onSubmit,
}: Props) {
  const [templates, setTemplates] = useState<CouponTemplate[]>([]);
  const [availablePeriods, setAvailablePeriods] = useState<AvailablePeriod[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);

  const form = useForm<QuestFormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      lore: initial?.lore ?? "",
      slug: initial?.slug ?? "",
      questType: initial?.questType ?? "orders_count",
      consumptionType: initial?.consumptionType ?? "",
      targetValue: initial?.targetValue ?? "",
      periodType: initial?.periodType ?? "weekly",
      couponTemplateId: initial?.couponTemplateId ?? NONE_TEMPLATE,
      bonusXp: initial?.bonusXp ?? "0",
      bonusCashback: initial?.bonusCashback ?? "0",
      displayOrder: initial?.displayOrder ?? "0",
      isActive: initial?.isActive ?? true,
      periods: initial?.periods ?? [],
      establishments: initial?.establishments ?? [],
    },
  });

  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const questType = watch("questType");
  const periodType = watch("periodType");
  const periods = watch("periods");
  const establishments = watch("establishments");
  const isActive = watch("isActive");

  useEffect(() => {
    getActiveTemplates()
      .then((data) => setTemplates(data || []))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    setLoadingPeriods(true);
    getAvailablePeriodsByType(periodType)
      .then((p) => setAvailablePeriods(p))
      .catch((err) => {
        console.error(err);
        setAvailablePeriods([]);
      })
      .finally(() => setLoadingPeriods(false));
  }, [periodType]);

  const handleNameChange = (name: string) => {
    setValue("name", name, { shouldValidate: true });
    if (mode === "create") {
      setValue("slug", generateSlug(name), { shouldValidate: true });
    }
  };

  const handleQuestTypeChange = (value: QuestType) => {
    setValue("questType", value, { shouldValidate: true });
    if (value === "quest_completed" && watch("periodType") === "weekly") {
      setValue("periodType", "monthly");
      setValue("periods", []);
    }
    if (value !== "consumption_count") {
      setValue("consumptionType", "");
    }
  };

  const handlePeriodTypeChange = (value: PeriodType) => {
    setValue("periodType", value);
    setValue("periods", []);
  };

  const handleTogglePeriod = (periodIdentifier: string) => {
    const current = watch("periods");
    setValue(
      "periods",
      current.includes(periodIdentifier)
        ? current.filter((p) => p !== periodIdentifier)
        : [...current, periodIdentifier],
    );
  };

  const handleRemovePeriod = (period: string) => {
    setValue(
      "periods",
      watch("periods").filter((p) => p !== period),
    );
  };

  const handleAddCurrentPeriod = () => {
    const current = getCurrentPeriodIdentifier(periodType);
    const list = watch("periods");
    if (!list.includes(current)) {
      setValue("periods", [...list, current]);
    }
  };

  const submit = handleSubmit(async (values) => {
    // amount_spent : euros saisis → centimes stockés. Autres types : int direct.
    const target =
      values.questType === "amount_spent"
        ? Math.round(parseFloat(values.targetValue) * 100)
        : parseInt(values.targetValue, 10);

    const payload: QuestFormPayload = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      lore: values.lore.trim() || null,
      slug: values.slug.trim(),
      quest_type: values.questType,
      consumption_type:
        values.questType === "consumption_count" && values.consumptionType
          ? (values.consumptionType as ConsumptionType)
          : null,
      target_value: target,
      period_type: values.periodType,
      coupon_template_id:
        values.couponTemplateId && values.couponTemplateId !== NONE_TEMPLATE
          ? parseInt(values.couponTemplateId, 10)
          : null,
      bonus_xp: parseInt(values.bonusXp, 10) || 0,
      bonus_cashback: Math.round(parseFloat(values.bonusCashback) * 100) || 0,
      display_order: parseInt(values.displayOrder, 10) || 0,
      is_active: values.isActive,
      periods: values.periods,
      establishments: values.establishments,
    };

    await onSubmit(payload);
  });

  const targetUnitLabel =
    questType === "amount_spent"
      ? "(€)"
      : questType === "cashback_earned"
      ? "(PdB)"
      : "";

  const targetHelp = (() => {
    switch (questType) {
      case "xp_earned":
        return "Quantité d'XP à gagner";
      case "amount_spent":
        return "Montant en euros à dépenser sur la période (ex: 50 = 50€)";
      case "cashback_earned":
        return "Nombre de Paraiges de Bronze à collecter (ex: 50 = 50 PdB)";
      case "establishments_visited":
        return "Nombre d'établissements à visiter";
      case "orders_count":
        return "Nombre de commandes à passer";
      case "quest_completed":
        return "Nombre de sous-périodes avec au moins 1 quête complétée";
      case "consumption_count":
        return "Quantité de produits du type sélectionné à consommer";
      default:
        return "";
    }
  })();

  return (
    <form onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle>Configuration de la quête</CardTitle>
          <CardDescription>
            {mode === "create"
              ? "Définissez l'objectif et les récompenses"
              : "Modifiez l'objectif et les récompenses"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Nom et slug */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nom de la quête *</Label>
              <Input
                id="name"
                placeholder="Ex: Habitué de la semaine"
                {...register("name")}
                onChange={(e) => handleNameChange(e.target.value)}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Identifiant unique (slug) *</Label>
              <Input
                id="slug"
                placeholder="habitue_semaine"
                className="font-mono"
                {...register("slug")}
              />
              {errors.slug && (
                <p className="text-xs text-destructive">{errors.slug.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Ex: Scannez 5 tickets cette semaine pour gagner une récompense"
              rows={2}
              {...register("description")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lore">Texte narratif (lore)</Label>
            <Textarea
              id="lore"
              placeholder="Ex: Les anciens racontent que seuls les plus assidus peuvent relever ce défi..."
              rows={3}
              {...register("lore")}
            />
            <p className="text-xs text-muted-foreground">
              Texte immersif affiché dans la modale de la quête côté client
            </p>
          </div>

          {/* Type / objectif / période */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Type de quête *</Label>
              <Controller
                control={control}
                name="questType"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => handleQuestTypeChange(v as QuestType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xp_earned">
                        Gagner de l&apos;XP
                      </SelectItem>
                      <SelectItem value="cashback_earned">
                        Collecter des Paraiges de Bronze
                      </SelectItem>
                      <SelectItem value="amount_spent">
                        Dépenser de l&apos;argent
                      </SelectItem>
                      <SelectItem value="establishments_visited">
                        Visiter des établissements
                      </SelectItem>
                      <SelectItem value="orders_count">
                        Passer des commandes
                      </SelectItem>
                      <SelectItem value="quest_completed">
                        Compléter des quêtes
                      </SelectItem>
                      <SelectItem value="consumption_count">
                        Consommer un type de produit
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetValue">
                Objectif {targetUnitLabel} *
              </Label>
              <Input
                id="targetValue"
                type="number"
                step={questType === "amount_spent" ? "0.01" : "1"}
                min={questType === "amount_spent" ? 0.01 : 1}
                {...register("targetValue")}
              />
              <p className="text-xs text-muted-foreground">{targetHelp}</p>
              {errors.targetValue && (
                <p className="text-xs text-destructive">
                  {errors.targetValue.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Période *</Label>
              <Controller
                control={control}
                name="periodType"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => handlePeriodTypeChange(v as PeriodType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        value="weekly"
                        disabled={questType === "quest_completed"}
                      >
                        Hebdomadaire
                      </SelectItem>
                      <SelectItem value="monthly">Mensuel</SelectItem>
                      <SelectItem value="yearly">Annuel</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.periodType && (
                <p className="text-xs text-destructive">
                  {errors.periodType.message}
                </p>
              )}
            </div>
          </div>

          {/* Type de produit (consumption_count) */}
          {questType === "consumption_count" && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <Label htmlFor="consumptionType">
                Type de produit à compter *
              </Label>
              <Controller
                control={control}
                name="consumptionType"
                render={({ field }) => (
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="consumptionType">
                      <SelectValue placeholder="Sélectionner un type de produit" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONSUMPTION_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.consumptionType && (
                <p className="text-xs text-destructive">
                  {errors.consumptionType.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                La progression compte la somme des <code>quantity</code> dans{" "}
                <code>receipt_consumption_items</code> du type choisi sur la
                période.
              </p>
            </div>
          )}

          {/* Périodes spécifiques */}
          <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label>Périodes spécifiques (optionnel)</Label>
              <p className="text-sm text-muted-foreground">
                Laissez vide pour activer la quête sur toutes les périodes.
                Sinon, sélectionnez les périodes sur lesquelles cette quête sera
                active.
              </p>
            </div>

            {periods.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {[...periods].sort().map((period) => (
                  <Badge key={period} variant="secondary" className="gap-1">
                    {period}
                    <button
                      type="button"
                      onClick={() => handleRemovePeriod(period)}
                      className="ml-1 rounded-full hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Aucune période spécifiée — la quête sera active sur toutes les
                périodes
              </p>
            )}

            <div className="flex items-center gap-4 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCurrentPeriod}
              >
                Ajouter période actuelle
              </Button>
            </div>

            <PeriodCalendar
              periodType={periodType}
              availablePeriods={availablePeriods}
              selectedPeriods={periods}
              onTogglePeriod={handleTogglePeriod}
              loadingPeriods={loadingPeriods}
            />
          </div>

          {/* Établissements */}
          <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label>Établissements ciblés</Label>
              <p className="text-sm text-muted-foreground">
                Restreignez la quête à certains établissements ou laissez vide
                pour qu&apos;elle soit globale. Les triggers de redondance
                bloquent toute configuration qui créerait un conflit avec une
                autre quête active de même signature.
              </p>
            </div>
            <EstablishmentsPicker
              value={establishments}
              onChange={(list) => setValue("establishments", list)}
              disabled={isSubmitting}
            />
          </div>

          {/* Récompenses */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Récompenses</h3>
            <p className="text-sm text-muted-foreground">
              Configurez au moins une récompense pour cette quête
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Template de coupon</Label>
                <Controller
                  control={control}
                  name="couponTemplateId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_TEMPLATE}>
                          Aucun coupon
                        </SelectItem>
                        {templates.map((template) => (
                          <SelectItem
                            key={template.id}
                            value={template.id.toString()}
                          >
                            {template.name}
                            {template.amount
                              ? ` (${formatCurrency(template.amount)} - Bonus CB immédiat)`
                              : template.percentage
                              ? ` (${template.percentage}% - Coupon sur commande)`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayOrder">
                  Ordre d&apos;affichage
                </Label>
                <Input
                  id="displayOrder"
                  type="number"
                  min={0}
                  {...register("displayOrder")}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bonusXp">Bonus XP</Label>
                <Input
                  id="bonusXp"
                  type="number"
                  placeholder="0"
                  min={0}
                  {...register("bonusXp")}
                />
                <p className="text-xs text-muted-foreground">
                  XP supplémentaire attribué à la complétion
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bonusCashback">Bonus Cashback (EUR)</Label>
                <Input
                  id="bonusCashback"
                  type="number"
                  placeholder="0"
                  min={0}
                  step="0.01"
                  {...register("bonusCashback")}
                />
                <p className="text-xs text-muted-foreground">
                  Cashback supplémentaire (ex: 5 = 5€)
                </p>
              </div>
            </div>
          </div>

          {/* Activation */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Quête active</Label>
              <p className="text-sm text-muted-foreground">
                Sera visible et accessible par les utilisateurs
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => setValue("isActive", checked)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Link href={cancelHref}>
              <Button type="button" variant="outline">
                Annuler
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {submitLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
