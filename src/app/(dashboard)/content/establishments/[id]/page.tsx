"use client";

import { useCallback, useEffect, useState } from "react";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  Upload,
  X,
  Edit,
  BarChart3,
  ShoppingCart,
  Banknote,
  Coins,
  TrendingUp,
  Award,
  PiggyBank,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import {
  getEstablishment,
  updateEstablishment,
  uploadEstablishmentImage,
  deleteEstablishmentImage,
  getImageUrl,
  getEstablishmentConsumptionTypes,
  setEstablishmentConsumptionTypes,
} from "@/lib/services/contentService";
import type { ConsumptionType } from "@/types/database";
import { Switch } from "@/components/ui/switch";
import {
  getAnalyticsRevenue,
  getAnalyticsDebts,
  getEmployeesByEstablishment,
  type RevenueData,
  type DebtsData,
} from "@/lib/services/analyticsService";
import { PeriodSelector, getPresetDates, type PeriodDates } from "@/components/period-selector";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";

const ALL_CONSUMPTION_TYPES: { type: ConsumptionType; label: string; icon: string }[] = [
  { type: "biere", label: "Biere", icon: "\u{1F37A}" },
  { type: "cocktail", label: "Cocktail", icon: "\u{1F378}" },
  { type: "alcool", label: "Alcool", icon: "\u{1F943}" },
  { type: "soft", label: "Soft", icon: "\u{1F964}" },
  { type: "boisson_chaude", label: "Boisson chaude", icon: "☕" },
  { type: "restauration", label: "Restauration", icon: "\u{1F37D}️" },
];

export default function EditEstablishmentPage() {
  const router = useRouter();
  const params = useParams();
  const id = parseInt(params.id as string);
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState("info");

  // Image principale
  const [currentFeaturedImage, setCurrentFeaturedImage] = useState<string | null>(null);
  const [newFeaturedFile, setNewFeaturedFile] = useState<File | null>(null);
  const [featuredPreview, setFeaturedPreview] = useState<string | null>(null);

  // Logo
  const [currentLogo, setCurrentLogo] = useState<string | null>(null);
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Consumption types
  const [consumptionTypesConfigured, setConsumptionTypesConfigured] = useState(false);
  const [activeConsumptionTypes, setActiveConsumptionTypes] = useState<Set<ConsumptionType>>(new Set());

  const [form, setForm] = useState({
    title: "",
    shortDescription: "",
    description: "",
    lineAddress1: "",
    lineAddress2: "",
    zipcode: "",
    city: "",
    country: "",
    anniversary: "",
  });

  // Stats tab state
  const [statsPeriod, setStatsPeriod] = useState<PeriodDates>(() => {
    const { start, end } = getPresetDates("all_time");
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [debtsData, setDebtsData] = useState<DebtsData | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const establishment = await getEstablishment(id);

        if (establishment) {
          setForm({
            title: establishment.title || "",
            shortDescription: establishment.short_description || "",
            description: establishment.description || "",
            lineAddress1: establishment.line_address_1 || "",
            lineAddress2: establishment.line_address_2 || "",
            zipcode: establishment.zipcode || "",
            city: establishment.city || "",
            country: establishment.country || "",
            anniversary: establishment.anniversary
              ? establishment.anniversary.split("T")[0] ?? ""
              : "",
          });
          setCurrentFeaturedImage(establishment.featured_image);
          setCurrentLogo(establishment.logo);

          // Fetch consumption types
          try {
            const ctRows = await getEstablishmentConsumptionTypes(id);
            if (ctRows.length > 0) {
              setConsumptionTypesConfigured(true);
              setActiveConsumptionTypes(
                new Set(ctRows.filter((r) => r.is_active).map((r) => r.consumption_type))
              );
            }
          } catch {
            // Non-blocking
          }
        } else {
          toast({
            variant: "destructive",
            title: "Erreur",
            description: "Établissement introuvable",
          });
          router.push("/content/establishments");
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de charger l'établissement",
        });
        router.push("/content/establishments");
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [id, router, toast]);

  // Load employees for this establishment
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await getEmployeesByEstablishment(id);
        setEmployees(data);
      } catch (error) {
        // Non-blocking
      }
    };
    fetchEmployees();
  }, [id]);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const filters = {
        startDate: statsPeriod.startDate,
        endDate: statsPeriod.endDate,
        establishmentId: id,
        employeeId: selectedEmployeeId && selectedEmployeeId !== "all" ? selectedEmployeeId : undefined,
      };
      const [revenue, debts] = await Promise.all([
        getAnalyticsRevenue(filters),
        getAnalyticsDebts(filters),
      ]);
      setRevenueData(revenue);
      setDebtsData(debts);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les statistiques",
      });
    } finally {
      setLoadingStats(false);
    }
  }, [statsPeriod, selectedEmployeeId, id, toast]);

  // Load stats when tab is active or filters change
  useEffect(() => {
    if (activeTab === "stats") {
      fetchStats();
    }
  }, [activeTab, fetchStats]);

  const handleFeaturedImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewFeaturedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFeaturedPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveFeaturedImage = () => {
    setNewFeaturedFile(null);
    setFeaturedPreview(null);
  };

  const handleRemoveLogo = () => {
    setNewLogoFile(null);
    setLogoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let newFeaturedPath = currentFeaturedImage;
      let newLogoPath = currentLogo;

      // Upload de l'image principale si modifiee
      if (newFeaturedFile) {
        if (currentFeaturedImage) {
          await deleteEstablishmentImage(currentFeaturedImage);
        }
        newFeaturedPath = await uploadEstablishmentImage(id, newFeaturedFile, "featured");
      }

      // Upload du logo si modifie
      if (newLogoFile) {
        if (currentLogo) {
          await deleteEstablishmentImage(currentLogo);
        }
        newLogoPath = await uploadEstablishmentImage(id, newLogoFile, "logo");
      }

      await updateEstablishment(id, {
        title: form.title,
        short_description: form.shortDescription || null,
        description: form.description || null,
        line_address_1: form.lineAddress1 || null,
        line_address_2: form.lineAddress2 || null,
        zipcode: form.zipcode || null,
        city: form.city || null,
        country: form.country || null,
        anniversary: form.anniversary || null,
        featured_image: newFeaturedPath,
        logo: newLogoPath,
      });

      // Save consumption types
      if (consumptionTypesConfigured) {
        await setEstablishmentConsumptionTypes(
          id,
          ALL_CONSUMPTION_TYPES.map((ct) => ({
            consumption_type: ct.type,
            is_active: activeConsumptionTypes.has(ct.type),
          }))
        );
      } else {
        // No config = delete all rows (fallback to "all active")
        await setEstablishmentConsumptionTypes(id, []);
      }

      toast({ title: "Établissement mis à jour" });
      router.push("/content/establishments");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre à jour l'établissement",
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/content/establishments">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{form.title || "Établissement"}</h1>
          <p className="text-muted-foreground">Gestion de l’établissement</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="info" className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Informations
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Statistiques
          </TabsTrigger>
        </TabsList>

        {/* Informations Tab - existing edit form */}
        <TabsContent value="info">
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle>Informations générales</CardTitle>
                <CardDescription>
                  Modifiez les informations de l’établissement
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Nom de l’établissement *</Label>
                  <Input
                    id="title"
                    placeholder="Ex: Le Royaume des Paraiges"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shortDescription">Description courte</Label>
                  <Input
                    id="shortDescription"
                    placeholder="Résumé en une ligne"
                    value={form.shortDescription}
                    onChange={(e) =>
                      setForm({ ...form, shortDescription: e.target.value })
                    }
                    maxLength={150}
                  />
                  <p className="text-xs text-muted-foreground">
                    {form.shortDescription.length}/150 caractères
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description complète</Label>
                  <Textarea
                    id="description"
                    placeholder="Description détaillée de l'établissement"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="anniversary">Date anniversaire</Label>
                  <Input
                    id="anniversary"
                    type="date"
                    value={form.anniversary}
                    onChange={(e) =>
                      setForm({ ...form, anniversary: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Date de création ou d’ouverture de l’établissement
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Images</CardTitle>
                <CardDescription>
                  Image principale et logo de l’établissement
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Image principale */}
                <div className="space-y-2">
                  <Label>Image principale</Label>
                  <div className="flex items-start gap-4">
                    {(featuredPreview || currentFeaturedImage) && (
                      <div className="relative">
                        <div className="flex h-32 w-48 items-center justify-center overflow-hidden rounded-lg border bg-muted/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={featuredPreview || getImageUrl(currentFeaturedImage) || ""}
                            alt="Image principale"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        {featuredPreview && (
                          <button
                            type="button"
                            onClick={handleRemoveFeaturedImage}
                            className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground hover:bg-destructive/90"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                    <div className="flex-1">
                      <label
                        htmlFor="featured-upload"
                        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 transition-colors hover:border-muted-foreground/50"
                      >
                        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {newFeaturedFile
                            ? newFeaturedFile.name
                            : currentFeaturedImage
                            ? "Changer l'image"
                            : "Importer une image"}
                        </span>
                        <span className="mt-1 text-xs text-muted-foreground">
                          PNG, JPG, WebP, AVIF jusqu’à 5MB
                        </span>
                      </label>
                      <input
                        id="featured-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/avif"
                        className="hidden"
                        onChange={handleFeaturedImageChange}
                      />
                    </div>
                  </div>
                </div>

                {/* Logo */}
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="flex items-start gap-4">
                    {(logoPreview || currentLogo) && (
                      <div className="relative">
                        <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg border bg-muted/10 p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={logoPreview || getImageUrl(currentLogo) || ""}
                            alt="Logo"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        {logoPreview && (
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground hover:bg-destructive/90"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                    <div className="flex-1">
                      <label
                        htmlFor="logo-upload"
                        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 transition-colors hover:border-muted-foreground/50"
                      >
                        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {newLogoFile
                            ? newLogoFile.name
                            : currentLogo
                            ? "Changer le logo"
                            : "Importer un logo"}
                        </span>
                        <span className="mt-1 text-xs text-muted-foreground">
                          PNG, JPG, WebP, AVIF jusqu’à 2MB
                        </span>
                      </label>
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/avif"
                        className="hidden"
                        onChange={handleLogoChange}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Adresse</CardTitle>
                <CardDescription>
                  Localisation de l’établissement
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="lineAddress1">Adresse ligne 1</Label>
                  <Input
                    id="lineAddress1"
                    placeholder="Numéro et rue"
                    value={form.lineAddress1}
                    onChange={(e) =>
                      setForm({ ...form, lineAddress1: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lineAddress2">Adresse ligne 2</Label>
                  <Input
                    id="lineAddress2"
                    placeholder="Complément d'adresse (optionnel)"
                    value={form.lineAddress2}
                    onChange={(e) =>
                      setForm({ ...form, lineAddress2: e.target.value })
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="zipcode">Code postal</Label>
                    <Input
                      id="zipcode"
                      placeholder="Ex: 57000"
                      value={form.zipcode}
                      onChange={(e) =>
                        setForm({ ...form, zipcode: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">Ville</Label>
                    <Input
                      id="city"
                      placeholder="Ex: Metz"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Pays</Label>
                    <Input
                      id="country"
                      placeholder="Ex: France"
                      value={form.country}
                      onChange={(e) =>
                        setForm({ ...form, country: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-4">
                  <Link href="/content/establishments">
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

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Types de consommation</CardTitle>
                <CardDescription>
                  Activez les types de produits proposés par cet établissement. Si aucun type n'est configuré, tous sont affichés par défaut dans le scanner.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch
                    id="configure-consumption-types"
                    checked={consumptionTypesConfigured}
                    onCheckedChange={(checked) => {
                      setConsumptionTypesConfigured(checked);
                      if (checked && activeConsumptionTypes.size === 0) {
                        setActiveConsumptionTypes(
                          new Set(ALL_CONSUMPTION_TYPES.map((ct) => ct.type))
                        );
                      }
                    }}
                  />
                  <Label htmlFor="configure-consumption-types">
                    Configurer les types de consommation
                  </Label>
                </div>

                {consumptionTypesConfigured && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {ALL_CONSUMPTION_TYPES.map((ct) => (
                      <div
                        key={ct.type}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{ct.icon}</span>
                          <span className="text-sm font-medium">{ct.label}</span>
                        </div>
                        <Switch
                          checked={activeConsumptionTypes.has(ct.type)}
                          onCheckedChange={(checked) => {
                            setActiveConsumptionTypes((prev) => {
                              const next = new Set(prev);
                              if (checked) {
                                next.add(ct.type);
                              } else {
                                next.delete(ct.type);
                              }
                              return next;
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        {/* Statistiques Tab */}
        <TabsContent value="stats" className="space-y-6">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <h2 className="hidden text-lg font-semibold sm:block">Statistiques</h2>
            <div className="flex flex-1 items-center gap-2 sm:flex-none sm:gap-3">
              {employees.length > 0 && (
                <Select
                  value={selectedEmployeeId}
                  onValueChange={setSelectedEmployeeId}
                >
                  <SelectTrigger className="min-w-0 flex-1 sm:flex-none sm:w-[200px]">
                    <SelectValue placeholder="Tous les employés" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les employés</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <PeriodSelector
                defaultPreset="all_time"
                onPeriodChange={setStatsPeriod}
              />
            </div>
          </div>

          {loadingStats ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : revenueData && debtsData ? (
            <div className="space-y-6">
              {/* Ligne 1 - Recettes */}
              <div>
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">Recettes</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard
                    title="Ventes"
                    icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />}
                    value={revenueData.salesCount}
                  />
                  <StatCard
                    title="CA Enregistré"
                    icon={<Banknote className="h-4 w-4 text-muted-foreground" />}
                    value={formatCurrency(revenueData.totalEuros)}
                    subtitle={`${formatCurrency(revenueData.cardTotal)} carte · ${formatCurrency(revenueData.cashTotal)} espèces`}
                  />
                  <StatCard
                    title="PdB Dépensés"
                    icon={<Coins className="h-4 w-4 text-muted-foreground" />}
                    value={formatCurrency(revenueData.cashbackSpentTotal)}
                  />
                </div>
              </div>

              {/* Ligne 2 - Dettes PdB */}
              <div>
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">Dettes PdB</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard
                    title="PdB Organiques"
                    icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
                    value={formatCurrency(debtsData.pdbOrganic)}
                  />
                  <StatCard
                    title="PdB Récompenses"
                    icon={<Award className="h-4 w-4 text-muted-foreground" />}
                    value={formatCurrency(debtsData.pdbRewards)}
                    subtitle={debtsData.hasFilter ? "Non filtrable par établissement" : undefined}
                  />
                  <StatCard
                    title="Total Dettes PdB"
                    icon={<PiggyBank className="h-4 w-4 text-muted-foreground" />}
                    value={formatCurrency(debtsData.pdbTotal)}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
