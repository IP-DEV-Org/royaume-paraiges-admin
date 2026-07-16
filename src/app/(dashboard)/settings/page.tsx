"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Percent, Wallet, Utensils, Repeat, X } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { useCurrentAdmin } from "@/components/providers/CurrentAdminProvider";
import { AdminAccessSection } from "./_components/admin-access-section";
import {
  SETTING_KEYS,
  getQuestAlertRatioPct,
  getQuestReferencePrices,
  getQuestRepeatConfig,
  updateAdminSetting,
  getAvgTicket12m,
  DEFAULT_QUEST_REPEAT_LEVEL_TIERS,
  type QuestReferencePrices,
  type QuestRepeatConfig,
  type QuestRepeatLevelTier,
} from "@/lib/services/adminSettingsService";
import { adminSettingsKeys } from "@/lib/queries/keys";

const REFERENCE_PRICE_TYPES: {
  key: keyof QuestReferencePrices;
  label: string;
}[] = [
  { key: "biere", label: "Bière" },
  { key: "cocktail", label: "Cocktail" },
  { key: "alcool", label: "Alcool" },
  { key: "soft", label: "Soft / soda" },
  { key: "boisson_chaude", label: "Boisson chaude" },
  { key: "restauration", label: "Restauration" },
];

function centsToEuros(cents: number | undefined): string {
  if (cents === undefined || cents === null || Number.isNaN(cents)) return "";
  return (cents / 100).toFixed(2);
}

function eurosToCents(value: string): number | null {
  const n = parseFloat(value.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SettingsTabs />
    </Suspense>
  );
}

// Onglets Général / Administrateurs (ce dernier réservé au super admin).
// L'onglet actif est synchronisé avec ?tab=admins pour permettre le deep-link
// (palette Cmd+K) — d'où le Suspense au-dessus (useSearchParams).
function SettingsTabs() {
  const { isSuperAdmin } = useCurrentAdmin();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tab =
    searchParams.get("tab") === "admins" && isSuperAdmin ? "admins" : "general";

  const handleTabChange = (value: string) => {
    router.replace(value === "admins" ? `${pathname}?tab=admins` : pathname, {
      scroll: false,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres"
        description="Réglages globaux de l'application et gestion des administrateurs."
      />
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="general">Général</TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="admins">Administrateurs</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="general" className="mt-6">
          <GeneralSettingsTab />
        </TabsContent>
        {isSuperAdmin && (
          <TabsContent value="admins" className="mt-6">
            <AdminAccessSection />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function GeneralSettingsTab() {
  const { data: ratio, isLoading: ratioLoading } = useQuery({
    queryKey: adminSettingsKeys.questAlertRatio(),
    queryFn: getQuestAlertRatioPct,
  });

  const { data: refPrices, isLoading: pricesLoading } = useQuery({
    queryKey: adminSettingsKeys.questReferencePrices(),
    queryFn: getQuestReferencePrices,
  });

  const { data: repeatConfig, isLoading: repeatLoading } = useQuery({
    queryKey: adminSettingsKeys.questRepeatLevelTiers(),
    queryFn: getQuestRepeatConfig,
  });

  const { data: avgTicket } = useQuery({
    queryKey: adminSettingsKeys.avgTicket12m(),
    queryFn: getAvgTicket12m,
  });

  if (
    ratioLoading ||
    pricesLoading ||
    repeatLoading ||
    ratio === undefined ||
    refPrices === undefined ||
    repeatConfig === undefined
  ) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SettingsForm
      initialRatio={ratio}
      initialPrices={refPrices}
      initialRepeatConfig={repeatConfig}
      avgTicketCents={avgTicket?.avg_ticket_cents ?? 0}
      avgTicketSample={avgTicket?.sample_size ?? 0}
    />
  );
}

function SettingsForm({
  initialRatio,
  initialPrices,
  initialRepeatConfig,
  avgTicketCents,
  avgTicketSample,
}: {
  initialRatio: number;
  initialPrices: QuestReferencePrices;
  initialRepeatConfig: QuestRepeatConfig;
  avgTicketCents: number;
  avgTicketSample: number;
}) {
  const queryClient = useQueryClient();

  const [ratioPct, setRatioPct] = useState(String(initialRatio));
  const [prices, setPrices] = useState<
    Record<keyof QuestReferencePrices, string>
  >({
    biere: centsToEuros(initialPrices.biere),
    cocktail: centsToEuros(initialPrices.cocktail),
    alcool: centsToEuros(initialPrices.alcool),
    soft: centsToEuros(initialPrices.soft),
    boisson_chaude: centsToEuros(initialPrices.boisson_chaude),
    restauration: centsToEuros(initialPrices.restauration),
  });
  const [repeatAuto, setRepeatAuto] = useState(
    initialRepeatConfig.mode === "auto",
  );
  const [repeatTiers, setRepeatTiers] = useState<
    { minLevel: string; maxCompletions: string }[]
  >(
    (initialRepeatConfig.mode === "manual"
      ? initialRepeatConfig.tiers
      : DEFAULT_QUEST_REPEAT_LEVEL_TIERS
    ).map((t) => ({
      minLevel: String(t.min_level),
      maxCompletions: String(t.max_completions),
    })),
  );

  const saveMutation = useMutation({
    mutationFn: async (input: {
      ratio: number;
      referencePrices: QuestReferencePrices;
      repeatValue: "auto" | QuestRepeatLevelTier[];
    }) => {
      await Promise.all([
        updateAdminSetting(SETTING_KEYS.QUEST_ALERT_RATIO_PCT, input.ratio),
        updateAdminSetting(
          SETTING_KEYS.QUEST_REFERENCE_PRICES_CENTS,
          input.referencePrices,
        ),
        updateAdminSetting(
          SETTING_KEYS.QUEST_REPEAT_LEVEL_TIERS,
          input.repeatValue,
        ),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSettingsKeys.all });
      toast.success("Paramètres enregistrés");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Impossible d'enregistrer les paramètres");
    },
  });

  const handleAddTier = () => {
    setRepeatTiers((prev) => [...prev, { minLevel: "", maxCompletions: "" }]);
  };

  const handleRemoveTier = (index: number) => {
    setRepeatTiers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTierChange = (
    index: number,
    field: "minLevel" | "maxCompletions",
    value: string,
  ) => {
    setRepeatTiers((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)),
    );
  };

  const handleSave = () => {
    const ratioValue = parseInt(ratioPct, 10);
    if (!Number.isFinite(ratioValue) || ratioValue <= 0 || ratioValue > 500) {
      toast.error("Seuil invalide", {
        description: "Le seuil doit être un entier entre 1 et 500.",
      });
      return;
    }

    const referencePrices: QuestReferencePrices = {};
    for (const { key, label } of REFERENCE_PRICE_TYPES) {
      const raw = prices[key];
      if (raw === "") continue;
      const cents = eurosToCents(raw);
      if (cents === null) {
        toast.error("Prix invalide", {
          description: `Le prix de "${label}" doit être un nombre positif.`,
        });
        return;
      }
      referencePrices[key] = cents;
    }

    // Répétition des défis : "auto" (lié aux rangs) ou barème manuel validé
    // (niveaux 1-25 uniques, complétions >= 1, au moins un palier).
    let repeatValue: "auto" | QuestRepeatLevelTier[] = "auto";
    if (!repeatAuto) {
      if (repeatTiers.length === 0) {
        toast.error("Barème invalide", {
          description: "Définissez au moins un palier (ex: niveau 1 → 1 complétion).",
        });
        return;
      }
      const parsedTiers: QuestRepeatLevelTier[] = [];
      const seenLevels = new Set<number>();
      for (const tier of repeatTiers) {
        const minLevel = parseInt(tier.minLevel, 10);
        const maxCompletions = parseInt(tier.maxCompletions, 10);
        if (!Number.isFinite(minLevel) || minLevel < 1 || minLevel > 25) {
          toast.error("Barème invalide", {
            description: "Chaque palier doit avoir un niveau entre 1 et 25.",
          });
          return;
        }
        if (!Number.isFinite(maxCompletions) || maxCompletions < 1) {
          toast.error("Barème invalide", {
            description: "Le nombre de complétions doit être un entier >= 1.",
          });
          return;
        }
        if (seenLevels.has(minLevel)) {
          toast.error("Barème invalide", {
            description: `Le niveau ${minLevel} est défini deux fois.`,
          });
          return;
        }
        seenLevels.add(minLevel);
        parsedTiers.push({ min_level: minLevel, max_completions: maxCompletions });
      }
      parsedTiers.sort((a, b) => a.min_level - b.min_level);
      repeatValue = parsedTiers;
    }

    saveMutation.mutate({
      ratio: ratioValue,
      referencePrices,
      repeatValue,
    });
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Réglages globaux utilisés pour le calcul et la surveillance des quêtes.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title="Panier moyen 12 mois"
          icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
          value={
            avgTicketCents > 0 ? `${(avgTicketCents / 100).toFixed(2)} €` : "—"
          }
          subtitle={`${avgTicketSample} tickets pris en compte (hors comptes test)`}
        />
        <StatCard
          title="Seuil d'alerte actuel"
          icon={<Percent className="h-4 w-4 text-muted-foreground" />}
          value={`${ratioPct} %`}
          subtitle="Voir les quêtes signalées sur la page Santé des quêtes"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Seuil d&apos;alerte des quêtes trop généreuses
          </CardTitle>
          <CardDescription>
            Une quête est signalée si son bonus cashback dépasse ce pourcentage
            du montant moyen qu&apos;un joueur dépense pour la compléter. Les
            quêtes signalées sont listées sur la page{" "}
            <Link
              href="/quests/health"
              className="underline hover:text-foreground"
            >
              Santé des quêtes
            </Link>
            . Les quêtes basées sur l&apos;XP ou la complétion d&apos;autres
            quêtes ne sont pas concernées.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="ratio">Seuil en pourcentage</Label>
          <div className="flex items-center gap-2">
            <Input
              id="ratio"
              type="number"
              min={1}
              max={500}
              step={1}
              value={ratioPct}
              onChange={(e) => setRatioPct(e.target.value)}
              className="max-w-32"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Valeur recommandée : <strong>10 %</strong>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5" />
            Prix de référence par type de consommation
          </CardTitle>
          <CardDescription>
            Prix moyen attendu pour un produit de chaque catégorie. Utilisés
            pour estimer combien un joueur va dépenser sur une quête « consommer
            N produits ». Laissez vide pour utiliser la valeur par défaut.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {REFERENCE_PRICE_TYPES.map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`price-${key}`}>{label}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`price-${key}`}
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="0.00"
                  value={prices[key]}
                  onChange={(e) =>
                    setPrices((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                />
                <span className="text-sm text-muted-foreground">€</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            Répétition des défis
          </CardTitle>
          <CardDescription>
            Nombre maximum de fois qu&apos;un joueur peut compléter un même
            défi sur une période. Ne concerne que les quêtes marquées
            « répétables ». Par défaut, le plafond suit le <strong>rang</strong>{" "}
            du joueur : rang 1 (Écuyer) → 1 fois, rang 2 (Soldat) → 2 fois,
            etc. — toute modification des rangs (page Storytelling) est
            automatiquement répercutée.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label>Barème automatique lié aux rangs</Label>
              <p className="text-xs text-muted-foreground">
                Rang N → N complétions par période. Désactivez pour définir un
                barème manuel par niveau.
              </p>
            </div>
            <Switch checked={repeatAuto} onCheckedChange={setRepeatAuto} />
          </div>

          {!repeatAuto && (
            <div className="space-y-3">
          {repeatTiers.map((tier, idx) => (
            <div key={idx} className="flex items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor={`tier-level-${idx}`}>À partir du niveau</Label>
                <Input
                  id={`tier-level-${idx}`}
                  type="number"
                  min={1}
                  max={25}
                  step={1}
                  placeholder="1"
                  value={tier.minLevel}
                  onChange={(e) =>
                    handleTierChange(idx, "minLevel", e.target.value)
                  }
                  className="max-w-32"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`tier-completions-${idx}`}>
                  Complétions max / période
                </Label>
                <Input
                  id={`tier-completions-${idx}`}
                  type="number"
                  min={1}
                  step={1}
                  placeholder="1"
                  value={tier.maxCompletions}
                  onChange={(e) =>
                    handleTierChange(idx, "maxCompletions", e.target.value)
                  }
                  className="max-w-32"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveTier(idx)}
                disabled={repeatTiers.length <= 1}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={handleAddTier}>
            Ajouter un palier
          </Button>

          <p className="text-xs text-muted-foreground">
            Le palier de plus haut niveau atteint s&apos;applique. En
            l&apos;absence de palier atteint, le joueur ne peut compléter le
            défi qu&apos;une seule fois (comportement historique).
          </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Enregistrer les paramètres
        </Button>
      </div>
    </div>
  );
}
