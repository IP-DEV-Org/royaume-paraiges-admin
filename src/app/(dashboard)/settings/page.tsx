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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Percent, Wallet, Utensils } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { useCurrentAdmin } from "@/components/providers/CurrentAdminProvider";
import { AdminAccessSection } from "./_components/admin-access-section";
import {
  SETTING_KEYS,
  getQuestAlertRatioPct,
  getQuestReferencePrices,
  updateAdminSetting,
  getAvgTicket12m,
  type QuestReferencePrices,
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

  const { data: avgTicket } = useQuery({
    queryKey: adminSettingsKeys.avgTicket12m(),
    queryFn: getAvgTicket12m,
  });

  if (
    ratioLoading ||
    pricesLoading ||
    ratio === undefined ||
    refPrices === undefined
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
      avgTicketCents={avgTicket?.avg_ticket_cents ?? 0}
      avgTicketSample={avgTicket?.sample_size ?? 0}
    />
  );
}

function SettingsForm({
  initialRatio,
  initialPrices,
  avgTicketCents,
  avgTicketSample,
}: {
  initialRatio: number;
  initialPrices: QuestReferencePrices;
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

  const saveMutation = useMutation({
    mutationFn: async (input: {
      ratio: number;
      referencePrices: QuestReferencePrices;
    }) => {
      await Promise.all([
        updateAdminSetting(SETTING_KEYS.QUEST_ALERT_RATIO_PCT, input.ratio),
        updateAdminSetting(
          SETTING_KEYS.QUEST_REFERENCE_PRICES_CENTS,
          input.referencePrices,
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

    saveMutation.mutate({ ratio: ratioValue, referencePrices });
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
