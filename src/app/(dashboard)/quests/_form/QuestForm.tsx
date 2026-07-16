"use client";

import { useEffect, useState, type ReactNode } from "react";
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

function FormSection({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const NONE_TEMPLATE = "none";
// Itérations : champ vide / "inherit" = hérite de la quête de base (NULL en BDD)
const INHERIT_TEMPLATE = "inherit";

const iterationRowSchema = z.object({
  targetValue: z.string(),
  couponTemplateId: z.string(),
  bonusXp: z.string(),
  bonusCashback: z.string(),
});

export type IterationRowInput = z.infer<typeof iterationRowSchema>;

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
    isRepeatable: z.boolean(),
    iterations: z.array(iterationRowSchema),
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

    if (data.isRepeatable) {
      data.iterations.forEach((row, idx) => {
        if (row.targetValue !== "") {
          const value =
            data.questType === "amount_spent"
              ? parseFloat(row.targetValue)
              : parseInt(row.targetValue, 10);
          if (isNaN(value) || value <= 0) {
            ctx.addIssue({
              code: "custom",
              message: "Objectif d'itération invalide (nombre > 0 ou vide pour hériter).",
              path: ["iterations", idx, "targetValue"],
            });
          }
        }
        if (row.bonusXp !== "" && (isNaN(parseInt(row.bonusXp, 10)) || parseInt(row.bonusXp, 10) < 0)) {
          ctx.addIssue({
            code: "custom",
            message: "Bonus XP invalide (entier >= 0 ou vide pour hériter).",
            path: ["iterations", idx, "bonusXp"],
          });
        }
        if (
          row.bonusCashback !== "" &&
          (isNaN(parseFloat(row.bonusCashback)) || parseFloat(row.bonusCashback) < 0)
        ) {
          ctx.addIssue({
            code: "custom",
            message: "Bonus cashback invalide (nombre >= 0 ou vide pour hériter).",
            path: ["iterations", idx, "bonusCashback"],
          });
        }
      });
    }
  });

export type QuestFormInput = z.infer<typeof formSchema>;

export interface QuestIterationPayload {
  iteration: number;
  target_value: number | null;
  coupon_template_id: number | null;
  bonus_xp: number | null;
  bonus_cashback: number | null;
}

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
  is_repeatable: boolean;
  iterations: QuestIterationPayload[];
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
      isRepeatable: initial?.isRepeatable ?? false,
      iterations: initial?.iterations ?? [],
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
  const isRepeatable = watch("isRepeatable");
  const iterations = watch("iterations");
  const baseTargetValue = watch("targetValue");
  const baseBonusXp = watch("bonusXp");
  const baseBonusCashback = watch("bonusCashback");
  const baseCouponTemplateId = watch("couponTemplateId");

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

  const handleAddIteration = () => {
    setValue("iterations", [
      ...watch("iterations"),
      {
        targetValue: "",
        couponTemplateId: INHERIT_TEMPLATE,
        bonusXp: "",
        bonusCashback: "",
      },
    ]);
  };

  const handleRemoveIteration = (index: number) => {
    setValue(
      "iterations",
      watch("iterations").filter((_, i) => i !== index),
    );
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
      is_repeatable: values.isRepeatable,
      // Champ vide = null = hérite de la quête de base. Les numéros d'itération
      // sont contigus à partir de 2 (itération 1 = la quête elle-même).
      iterations: values.isRepeatable
        ? values.iterations.map((row, idx) => ({
            iteration: idx + 2,
            target_value:
              row.targetValue === ""
                ? null
                : values.questType === "amount_spent"
                ? Math.round(parseFloat(row.targetValue) * 100)
                : parseInt(row.targetValue, 10),
            coupon_template_id:
              row.couponTemplateId && row.couponTemplateId !== INHERIT_TEMPLATE
                ? parseInt(row.couponTemplateId, 10)
                : null,
            bonus_xp: row.bonusXp === "" ? null : parseInt(row.bonusXp, 10) || 0,
            bonus_cashback:
              row.bonusCashback === ""
                ? null
                : Math.round(parseFloat(row.bonusCashback) * 100) || 0,
          }))
        : [],
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
      <Card className="border-none bg-transparent shadow-none">
        <CardHeader className="px-0">
          <CardTitle>Configuration de la quête</CardTitle>
          <CardDescription>
            {mode === "create"
              ? "Définissez l'objectif et les récompenses"
              : "Modifiez l'objectif et les récompenses"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 px-0">
          {/* Informations générales */}
          <FormSection
            title="Informations générales"
            description="Nom, identifiant et textes affichés côté client."
          >
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
                  <p className="text-xs text-destructive">
                    {errors.name.message}
                  </p>
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
                  <p className="text-xs text-destructive">
                    {errors.slug.message}
                  </p>
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
          </FormSection>

          {/* Objectif */}
          <FormSection
            title="Objectif"
            description="Définissez ce que le joueur doit accomplir et sur quelle période."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Type de quête *</Label>
                <Controller
                  control={control}
                  name="questType"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) =>
                        handleQuestTypeChange(v as QuestType)
                      }
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
                      onValueChange={(v) =>
                        handlePeriodTypeChange(v as PeriodType)
                      }
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
          </FormSection>

          {/* Périodes spécifiques */}
          <FormSection
            title="Périodes de disponibilité"
            description="Laissez vide pour activer la quête sur toutes les périodes. Sinon, sélectionnez les périodes sur lesquelles cette quête sera active."
          >
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
          </FormSection>

          {/* Établissements */}
          <FormSection
            title="Établissements ciblés"
            description="Restreignez la quête à certains établissements ou laissez vide pour qu'elle soit globale. Les triggers de redondance bloquent toute configuration qui créerait un conflit avec une autre quête active de même signature."
          >
            <EstablishmentsPicker
              value={establishments}
              onChange={(list) => setValue("establishments", list)}
              disabled={isSubmitting}
            />
          </FormSection>

          {/* Récompenses */}
          <FormSection
            title="Récompenses"
            description="Configurez au moins une récompense pour cette quête."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Template de coupon</Label>
                <Controller
                  control={control}
                  name="couponTemplateId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
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
                <Label htmlFor="displayOrder">Ordre d&apos;affichage</Label>
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
          </FormSection>

          {/* Répétition selon le niveau */}
          <FormSection
            title="Répétition selon le niveau"
            description="Désactivée par défaut. Si activée, les joueurs de rang élevé peuvent compléter la quête plusieurs fois par période. Le nombre d'itérations ajoutées ici fixe le maximum affiché côté joueur : chaque itération = une répétition supplémentaire possible (l'itération 1 = la configuration ci-dessus). Un joueur de rang inférieur en voit moins, mais jamais plus que ce qui est configuré ici."
            action={
              <Switch
                checked={isRepeatable}
                onCheckedChange={(checked) =>
                  setValue("isRepeatable", checked)
                }
              />
            }
          >
            {isRepeatable && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Personnalisez l&apos;objectif et les gains des itérations
                  suivantes. Champ vide = hérite de la quête de base. Le badge
                  n&apos;est attribué qu&apos;une fois par période.
                </p>

                {iterations.map((row, idx) => (
                  <div
                    key={idx}
                    className="space-y-3 rounded-lg border bg-background p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Itération {idx + 2}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveIteration(idx)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-xs">
                          Objectif {targetUnitLabel}
                        </Label>
                        <Input
                          type="number"
                          step={questType === "amount_spent" ? "0.01" : "1"}
                          min={questType === "amount_spent" ? 0.01 : 1}
                          placeholder={baseTargetValue || "hérite"}
                          {...register(`iterations.${idx}.targetValue`)}
                        />
                        {errors.iterations?.[idx]?.targetValue && (
                          <p className="text-xs text-destructive">
                            {errors.iterations[idx]?.targetValue?.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Coupon</Label>
                        <Controller
                          control={control}
                          name={`iterations.${idx}.couponTemplateId`}
                          render={({ field }) => (
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={INHERIT_TEMPLATE}>
                                  {baseCouponTemplateId &&
                                  baseCouponTemplateId !== NONE_TEMPLATE
                                    ? "Hériter (coupon de base)"
                                    : "Hériter (aucun coupon)"}
                                </SelectItem>
                                {templates.map((template) => (
                                  <SelectItem
                                    key={template.id}
                                    value={template.id.toString()}
                                  >
                                    {template.name}
                                    {template.amount
                                      ? ` (${formatCurrency(template.amount)})`
                                      : template.percentage
                                      ? ` (${template.percentage}%)`
                                      : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Bonus XP</Label>
                        <Input
                          type="number"
                          min={0}
                          placeholder={baseBonusXp || "hérite"}
                          {...register(`iterations.${idx}.bonusXp`)}
                        />
                        {errors.iterations?.[idx]?.bonusXp && (
                          <p className="text-xs text-destructive">
                            {errors.iterations[idx]?.bonusXp?.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Bonus Cashback (EUR)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder={baseBonusCashback || "hérite"}
                          {...register(`iterations.${idx}.bonusCashback`)}
                        />
                        {errors.iterations?.[idx]?.bonusCashback && (
                          <p className="text-xs text-destructive">
                            {errors.iterations[idx]?.bonusCashback?.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddIteration}
                >
                  Ajouter une itération
                </Button>
              </div>
            )}
          </FormSection>

          {/* Activation */}
          <FormSection
            title="Activation"
            description="Sera visible et accessible par les utilisateurs."
            action={
              <Switch
                checked={isActive}
                onCheckedChange={(checked) => setValue("isActive", checked)}
              />
            }
          >
            {null}
          </FormSection>

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
