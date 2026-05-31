"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { ArrowLeft, Loader2 } from "lucide-react";
import { createPeriodConfig } from "@/lib/services/rewardService";
import { getCurrentPeriodIdentifier } from "@/lib/services/periodService";
import { useToast } from "@/components/ui/use-toast";
import type { PeriodType } from "@/types/database";

export default function CreatePeriodPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    periodType: "weekly" as PeriodType,
    periodIdentifier: getCurrentPeriodIdentifier("weekly"),
    notes: "",
  });

  const handlePeriodTypeChange = (value: PeriodType) => {
    setForm({
      ...form,
      periodType: value,
      periodIdentifier: getCurrentPeriodIdentifier(value),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await createPeriodConfig({
        period_type: form.periodType,
        period_identifier: form.periodIdentifier,
        notes: form.notes || null,
      });

      toast({ title: "Periode créée avec succes" });
      router.push(`/rewards/periods/${form.periodType}/${form.periodIdentifier}`);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de creer la periode. Elle existe peut-être deja.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/rewards/periods">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Nouvelle periode</h1>
          <p className="text-muted-foreground">
            Créez une configuration de periode personnalisee
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Configuration de la periode</CardTitle>
            <CardDescription>
              Définissez la periode que vous souhaitez configurer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Type de periode *</Label>
                <Select
                  value={form.periodType}
                  onValueChange={handlePeriodTypeChange}
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

              <div className="space-y-2">
                <Label htmlFor="periodIdentifier">Identifiant de periode *</Label>
                <Input
                  id="periodIdentifier"
                  placeholder={
                    form.periodType === "weekly"
                      ? "2026-W04"
                      : form.periodType === "monthly"
                      ? "2026-01"
                      : "2026"
                  }
                  value={form.periodIdentifier}
                  onChange={(e) =>
                    setForm({ ...form, periodIdentifier: e.target.value })
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {form.periodType === "weekly" && "Format: YYYY-Www (ex: 2026-W04)"}
                  {form.periodType === "monthly" && "Format: YYYY-MM (ex: 2026-01)"}
                  {form.periodType === "yearly" && "Format: YYYY (ex: 2026)"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Ex: Semaine spéciale anniversaire, configuration personnalisee"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-4">
              <Link href="/rewards/periods">
                <Button type="button" variant="outline">
                  Annuler
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Creer et configurer
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
