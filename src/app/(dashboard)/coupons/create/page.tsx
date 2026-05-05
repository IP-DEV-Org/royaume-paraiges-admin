"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { couponKeys } from "@/lib/queries/keys";
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
import { ArrowLeft, Loader2, User } from "lucide-react";
import { createManualCoupon, searchCustomers } from "@/lib/services/couponService";
import { getActiveTemplates } from "@/lib/services/templateService";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import type { CouponTemplate, Profile } from "@/types/database";

const formSchema = z
  .object({
    customerId: z.string().uuid("Sélectionnez un utilisateur"),
    customerName: z.string(),
    mode: z.enum(["template", "custom"]),
    templateId: z.string().optional(),
    amount: z.string().optional(),
    percentage: z.string().optional(),
    expiresAt: z.string().optional(),
    notes: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "template") {
      if (!data.templateId) {
        ctx.addIssue({
          code: "custom",
          message: "Sélectionnez un template.",
          path: ["templateId"],
        });
      }
    } else {
      const amountNum = data.amount ? parseFloat(data.amount) : NaN;
      const percentageNum = data.percentage ? parseInt(data.percentage, 10) : NaN;
      const hasAmount = !isNaN(amountNum) && amountNum > 0;
      const hasPercentage = !isNaN(percentageNum) && percentageNum > 0;

      if (!hasAmount && !hasPercentage) {
        ctx.addIssue({
          code: "custom",
          message: "Renseignez un montant ou un pourcentage.",
          path: ["amount"],
        });
      }
      if (hasAmount && hasPercentage) {
        ctx.addIssue({
          code: "custom",
          message: "Renseignez soit un montant, soit un pourcentage — pas les deux.",
          path: ["amount"],
        });
      }
      if (hasPercentage && (percentageNum < 1 || percentageNum > 100)) {
        ctx.addIssue({
          code: "custom",
          message: "Le pourcentage doit être entre 1 et 100.",
          path: ["percentage"],
        });
      }
    }
  });

type FormInput = z.infer<typeof formSchema>;

export default function CreateCouponPage() {
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [templates, setTemplates] = useState<CouponTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  const form = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: "",
      customerName: "",
      mode: "template",
      templateId: "",
      amount: "",
      percentage: "",
      expiresAt: "",
      notes: "",
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

  const customerId = watch("customerId");
  const customerName = watch("customerName");
  const mode = watch("mode");
  const templateId = watch("templateId");

  useEffect(() => {
    getActiveTemplates()
      .then((data) => setTemplates(data || []))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchQuery.length >= 3) {
        setSearching(true);
        searchCustomers(searchQuery)
          .then((results) => setSearchResults(results || []))
          .catch(() =>
            toast.error("Erreur", { description: "Erreur lors de la recherche" }),
          )
          .finally(() => setSearching(false));
      } else if (searchQuery.length === 0) {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const selectCustomer = (customer: Profile) => {
    const name =
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
      customer.email ||
      "Inconnu";
    setValue("customerId", customer.id, { shouldValidate: true });
    setValue("customerName", name);
    setSearchResults([]);
    setSearchQuery("");
  };

  const clearCustomer = () => {
    setValue("customerId", "", { shouldValidate: true });
    setValue("customerName", "");
  };

  const onModeChange = (value: "template" | "custom") => {
    setValue("mode", value);
    setValue("templateId", "");
    setValue("amount", "");
    setValue("percentage", "");
  };

  const selectedTemplate = templates.find(
    (t) => t.id.toString() === templateId,
  );

  const submit = handleSubmit(async (values) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await createManualCoupon({
        customerId: values.customerId,
        templateId:
          values.mode === "template" && values.templateId
            ? parseInt(values.templateId, 10)
            : undefined,
        amount:
          values.mode === "custom" && values.amount
            ? Math.round(parseFloat(values.amount) * 100)
            : undefined,
        percentage:
          values.mode === "custom" && values.percentage
            ? parseInt(values.percentage, 10)
            : undefined,
        expiresAt: values.expiresAt || undefined,
        notes: values.notes || undefined,
        adminId: user?.id,
      });

      let successMessage = "Coupon attribué avec succès";
      if (values.mode === "custom") {
        if (values.amount) {
          successMessage = `Bonus cashback de ${values.amount} EUR crédité`;
        } else if (values.percentage) {
          successMessage = `Coupon de ${values.percentage}% attribué`;
        }
      } else if (values.mode === "template" && selectedTemplate) {
        if (selectedTemplate.amount) {
          successMessage = `Bonus cashback de ${formatCurrency(selectedTemplate.amount)} crédité`;
        } else if (selectedTemplate.percentage) {
          successMessage = `Coupon de ${selectedTemplate.percentage}% attribué`;
        }
      }

      queryClient.invalidateQueries({ queryKey: couponKeys.all });
      toast.success(successMessage);
      router.push("/coupons");
    } catch (err) {
      console.error(err);
      toast.error("Erreur", {
        description: err instanceof Error ? err.message : "Impossible de créer le coupon",
      });
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/coupons">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Attribution manuelle</h1>
          <p className="text-muted-foreground">
            Attribuez un bonus cashback ou coupon à un utilisateur
          </p>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Utilisateur</CardTitle>
              <CardDescription>
                Recherchez et sélectionnez l&apos;utilisateur destinataire
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {customerId ? (
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{customerName}</p>
                      <p className="text-sm text-muted-foreground">
                        ID: {customerId.slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearCustomer}
                  >
                    Changer
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Input
                      placeholder="Rechercher par nom ou email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searching && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {searchResults.length > 0 && (
                    <div className="rounded-lg border">
                      {searchResults.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          className="flex w-full items-center gap-3 border-b p-3 text-left last:border-b-0 hover:bg-accent"
                          onClick={() => selectCustomer(customer)}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {`${customer.first_name || ""} ${
                                customer.last_name || ""
                              }`.trim() || "Sans nom"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {customer.email}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {errors.customerId && (
                <p className="text-xs text-destructive">
                  {errors.customerId.message}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Valeur du coupon</CardTitle>
              <CardDescription>
                Utilisez un template ou définissez une valeur personnalisée
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Mode</Label>
                <Controller
                  control={control}
                  name="mode"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) =>
                        onModeChange(v as "template" | "custom")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="template">
                          Depuis un template
                        </SelectItem>
                        <SelectItem value="custom">
                          Valeur personnalisée
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {mode === "template" ? (
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Controller
                    control={control}
                    name="templateId"
                    render={({ field }) => (
                      <Select
                        value={field.value || ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un template" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((template) => (
                            <SelectItem
                              key={template.id}
                              value={template.id.toString()}
                            >
                              {template.name} -{" "}
                              {template.amount
                                ? formatCurrency(template.amount)
                                : template.percentage
                                ? formatPercentage(template.percentage)
                                : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.templateId && (
                    <p className="text-xs text-destructive">
                      {errors.templateId.message}
                    </p>
                  )}
                  {selectedTemplate && (
                    <p className="text-sm text-muted-foreground">
                      {selectedTemplate.description}{" "}
                      {selectedTemplate.amount
                        ? "(Bonus Cashback immédiat)"
                        : selectedTemplate.percentage
                        ? "(Coupon % sur commande)"
                        : ""}
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Bonus Cashback (EUR)</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 5"
                      min={0.01}
                      step="0.01"
                      {...register("amount")}
                    />
                    {errors.amount && (
                      <p className="text-xs text-destructive">
                        {errors.amount.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Sera crédité immédiatement au solde cashback
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Coupon (%)</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 10"
                      min={1}
                      max={100}
                      {...register("percentage")}
                    />
                    {errors.percentage && (
                      <p className="text-xs text-destructive">
                        {errors.percentage.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Cashback supplémentaire sur la prochaine commande
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Options supplémentaires</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Date d&apos;expiration (optionnel)</Label>
                  <Input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    {...register("expiresAt")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes (optionnel)</Label>
                <Textarea
                  placeholder="Raison de l'attribution, contexte..."
                  rows={3}
                  {...register("notes")}
                />
                {errors.notes && (
                  <p className="text-xs text-destructive">
                    {errors.notes.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-4">
                <Link href="/coupons">
                  <Button type="button" variant="outline">
                    Annuler
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Attribuer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
