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
import { ArrowLeft, Loader2 } from "lucide-react";
import { getTemplate, updateTemplate } from "@/lib/services/templateService";
import { toast } from "sonner";
import type { CouponTemplateUpdate } from "@/types/database";

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const id = parseInt(params.id as string);

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [form, setForm] = useState({
    name: "",
    description: "",
    lore: "",
    valueType: "amount" as "amount" | "percentage",
    amount: "",
    percentage: "",
    validityDays: "",
    isActive: true,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const template = await getTemplate(id);

        if (template) {
          setForm({
            name: template.name,
            description: template.description || "",
            lore: template.lore || "",
            valueType: template.amount ? "amount" : "percentage",
            amount: template.amount ? (template.amount / 100).toString() : "",
            percentage: template.percentage?.toString() || "",
            validityDays: template.validity_days?.toString() || "",
            isActive: template.is_active ?? true,
          });
        }
      } catch (error) {
        toast.error("Erreur", {
          description: "Impossible de charger le template",
        });
        router.push("/templates");
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
      const template: CouponTemplateUpdate = {
        name: form.name,
        description: form.description || null,
        lore: form.lore || null,
        amount: form.valueType === "amount" ? Math.round(parseFloat(form.amount) * 100) : null,
        percentage:
          form.valueType === "percentage" ? parseInt(form.percentage) : null,
        validity_days: form.validityDays ? parseInt(form.validityDays) : null,
        is_active: form.isActive,
      };

      await updateTemplate(id, template);
      toast.success("Template mis à jour");
      router.push("/templates");
    } catch (error) {
      toast.error("Erreur", {
        description: "Impossible de mettre a jour le template",
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
        <Link href="/templates">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Modifier le template</h1>
          <p className="text-muted-foreground">{form.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Informations du template</CardTitle>
            <CardDescription>
              Modifiez les caractéristiques du coupon
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du template *</Label>
              <Input
                id="name"
                placeholder="Ex: Coupon Champion Hebdo"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Description optionnelle du template"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={3}
              />
            </div>

          <div className="space-y-2">
            <Label htmlFor="lore">Texte narratif (lore)</Label>
            <Textarea
              id="lore"
              placeholder="Ex: Ce précieux parchemin témoigne de votre rang parmi les plus fidèles du Royaume..."
              value={form.lore}
              onChange={(e) => setForm({ ...form, lore: e.target.value })}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Texte immersif affiché dans la modale du coupon côté client
            </p>
          </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Type de valeur *</Label>
                <Select
                  value={form.valueType}
                  onValueChange={(value: "amount" | "percentage") =>
                    setForm({ ...form, valueType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amount">Bonus Cashback (EUR)</SelectItem>
                    <SelectItem value="percentage">Coupon (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.valueType === "amount" ? (
                <div className="space-y-2">
                  <Label htmlFor="amount">Montant (EUR) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Ex: 5 pour 5€"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                    min={0.01}
                    step="0.01"
                  />
                  <p className="text-xs text-muted-foreground">Crédité immediatement au solde cashback du joueur</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="percentage">Pourcentage *</Label>
                  <Input
                    id="percentage"
                    type="number"
                    placeholder="Ex: 10 pour 10%"
                    value={form.percentage}
                    onChange={(e) =>
                      setForm({ ...form, percentage: e.target.value })
                    }
                    required
                    min={1}
                    max={100}
                  />
                  <p className="text-xs text-muted-foreground">Cashback supplémentaire applique sur la commande</p>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {form.valueType === "percentage" && (
                <div className="space-y-2">
                  <Label htmlFor="validity">Durée de validite (jours)</Label>
                  <Input
                    id="validity"
                    type="number"
                    placeholder="Laisser vide pour sans expiration"
                    value={form.validityDays}
                    onChange={(e) =>
                      setForm({ ...form, validityDays: e.target.value })
                    }
                    min={1}
                  />
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Template actif</Label>
                  <p className="text-sm text-muted-foreground">
                    Peut etre utilise pour creer des coupons
                  </p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, isActive: checked })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Link href="/templates">
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
